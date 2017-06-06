const fs = require('fs');
const webpack = require('webpack');
const MultipleCommonsChunkLoadPlugin = require('./MultipleCommonsChunkLoadPlugin');
const MultipleCommonsChunkWaitPlugin = require('./MultipleCommonsChunkWaitPlugin');

const OWN_SOURCE_FOR_HASH = fs.readFileSync(__filename);
const WAITLOAD_SOURCE = fs.readFileSync(__dirname + '/waitload.js');

function without(collection, items) {
  return collection.filter(
    item => (Array.isArray(items) ? items : [items]).indexOf(item) === -1
  );
}

const RUNTIME_CHUNK_NAME = 'main';

const MAIN_COMMON_CHUNK_CONFIG = {
  chunks: 'all',
  excludeChunks: [],
  minChunks: Infinity,
};

module.exports = function QuizletCommonChunksPlugin(
  entryBundles,
  // Map of common chunk name -> list of chunks that depend on it
  // NB: Be careful about having these chunks QWait on each other!
  commonsChunkConfig,
  filenameCallback = commonChunk => commonChunk,
  outputFilename
) {
  const commonChunkDependents = {};

  return {
    apply(compiler) {
      compiler.plugin('compilation', compilation => {
        // NB we want to protect against modifying main chunks created through
        // worker-loader
        if (compilation.compiler.name === 'worker') return;

        // We need to hook into the 'startup' event because that happens after
        // __webpack_require__ methods are defined
        compilation.mainTemplate.plugin('startup', function(source, chunk) {
          // this.outputOptions is the output object config from webpack
          const jsonpFunction = this.outputOptions.jsonpFunction;

          return (
            `
if (typeof parentJsonpFunction !== 'undefined'){
  parentJsonpFunction.l=0;
  parentJsonpFunction.p.forEach(function(args) {
    ${jsonpFunction}.apply(this, args);
  });
  delete parentJsonpFunction.p;
}` + WAITLOAD_SOURCE
          );
        });

        compilation.plugin('chunk-hash', (chunk, chunkHash) => {
          chunkHash.update(OWN_SOURCE_FOR_HASH + WAITLOAD_SOURCE);
        });
      });

      compiler.apply(new MultipleCommonsChunkLoadPlugin(commonsChunkConfig));

      commonsChunkConfig[RUNTIME_CHUNK_NAME] = MAIN_COMMON_CHUNK_CONFIG;

      // build a common chunk per-locale, since sometimes webpack changes the require numbers
      Object.keys(commonsChunkConfig).forEach(commonChunk => {
        const filename = filenameCallback(commonChunk);
        const config = Object.assign({}, commonsChunkConfig[commonChunk], {
          filename,
        });

        if (config.chunks === 'all') config.chunks = entryBundles.slice(0);
        config.names = [commonChunk];

        // Remove explicitly exluded chunks from the common chunks list as well
        // as the current chunk itself (config.names)
        config.chunks = without(
          config.chunks,
          config.excludeChunks.concat(config.names)
        );

        commonChunkDependents[commonChunk] = config.chunks;

        delete config.excludeChunks;

        // If this common chunk is just in config to polyfill browser behavior
        // we don't want to tell webpack about it. Otherwise node modules that
        // appear in our code and the polyfill will be bundled in the polyfill
        // which will not load if the browser supports the feature
        if (config.minChunks !== 'polyfill') {
          compiler.apply(new webpack.optimize.CommonsChunkPlugin(config));
        }
      });

      if (outputFilename) {
        compiler.plugin('emit', function(compilation, callback) {
          // So it's easier to figure out which common chunks we need to load
          // given entry bundles, convert commonChunkDependents from
          // commonChunk => [entryBundle, ...]
          // to
          // entryBundle => [commonChunk, ...]
          const dependentsToCommonChunks = entryBundles.reduce(
            (carry, chunkName) => {
              carry[chunkName] = Object.keys(
                commonChunkDependents
              ).filter(commonChunkName =>
                commonChunkDependents[commonChunkName].includes(chunkName)
              );
              return carry;
            },
            {}
          );

          fs.writeFileSync(
            outputFilename,
            JSON.stringify(dependentsToCommonChunks, null, 2)
          );

          callback();
        });
      }

      // Wrap async dependencies in QWait
      compiler.apply(
        new MultipleCommonsChunkWaitPlugin(commonChunkDependents)
      );
    },
  };
};
