const fs = require('fs');
const ConcatSource = require('webpack-sources/lib/ConcatSource');

const OWN_SOURCE_FOR_HASH = fs.readFileSync(__filename);

/*
 * This plugin adds a QLoad statement to the bottom of our commons chunks so
 * that we mark them as loaded only after their modules have been added to
 * the webpack runtime. This is better than using the onload attribute on
 * <script> tags which fire once the <script> is downloaded which does not give
 * us ordering guarantees.
*/
module.exports = function QuizletLoadCommonsChunkPlugin(commonChunksConfig) {
  function getSourceSuffix(chunk) {
    return `;QLoad("Quizlet.Common.${chunk.name}");`;
  }

  return {
    apply(compiler) {
      compiler.plugin('compilation', compilation => {
        // NB we want to protect against modifying main chunks created through
        // worker-loader
        if (compilation.compiler.name === 'worker') return;

        compilation.mainTemplate.plugin('render', function(
          moduleSource,
          chunk
        ) {
          return chunk.name === 'main'
            ? new ConcatSource(moduleSource, getSourceSuffix(chunk))
            : moduleSource;
        });

        compilation.moduleTemplate.plugin(
          'render',
          (moduleSource, module, chunk) => {
            // If this chunk is a common chunk and this module is an
            // entryModule for this chunk, then we want to insert a QLoad() to
            // indicate the chunk has loaded & executed.
            if (
              chunk.name !== 'main' &&
              Object.keys(commonChunksConfig).indexOf(chunk.name) !== -1 &&
              chunk.entryModule &&
              chunk.entryModule.id === module.id
            ) {
              return new ConcatSource(moduleSource, getSourceSuffix(chunk));
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
