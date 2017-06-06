const fs = require('fs');
const ConcatSource = require('webpack-sources/lib/ConcatSource');

const OWN_SOURCE_FOR_HASH = fs.readFileSync(__filename);

// Adds QWaits around javascript bundles to handle async nature of loading.
// This plugin should only be invoked once per webpack run because of special
// casing around non-initial chunks (otherwise they will have multiple QWaits
// around main).
module.exports = function MultipleCommonsChunkWaitPlugin(
  commonChunkDependents
) {
  function getBundlesToWaitOn(chunk) {
    return (
      Object.keys(commonChunkDependents)
        .filter(
          commonChunk =>
            commonChunk !== 'main' &&
            commonChunkDependents[commonChunk].indexOf(chunk.name) > -1
        )
        // Prevent entries from waiting on themselves
        .filter(commonChunk => commonChunk !== chunk.name)
        .map(commonChunk => JSON.stringify(`Quizlet.Common.${commonChunk}`))
        .join(',')
    );
  }

  function getSourcePrefix(bundlesToWaitOn) {
    return 'QWait(' + bundlesToWaitOn + ',function(){';
  }

  function getSourceSuffix() {
    return '});';
  }

  return {
    apply(compiler) {
      compiler.plugin('compilation', compilation => {
        compilation.moduleTemplate.plugin(
          'render',
          (moduleSource, module, chunk) => {
            // If this module is an entryModule for this chunk, then we want
            // to wrap it in the necessary QWait.
            if (
              chunk.entryModule &&
              chunk.entryModule.id === module.id &&
              getBundlesToWaitOn(chunk)
            ) {
              return new ConcatSource(
                getSourcePrefix(getBundlesToWaitOn(chunk)),
                moduleSource,
                getSourceSuffix()
              );
            }
            return moduleSource;
          }
        );

        // Make sure to update the chunk hash for the bundles we're affecting
        // based on the contents that this plugin adds to the chunks
        compilation.plugin('chunk-hash', (chunk, chunkHash) => {
          chunkHash.update(OWN_SOURCE_FOR_HASH);
        });
      });
    },
  };
};
