# MultipleCommonsChunkPlugin

Webpack plugin to declaratively configure multiple common javascript chunks.

[![NPM version][npm-image]][npm-url] 

## What is this?

See the backstory and how Quizlet uses this to deliver javascript in the announcment blog post [link coming]!

This plugin properly orders your javascript bundle execution and also defines `QWait` and `QLoad` on the `window` object.

## Installation and usage

### The inlined shim
```js
window.QWait=function(){QWait.p.push(arguments)};QWait.p=[];
window.QLoad=function(){QLoad.p.push(arguments)};QLoad.p=[];
window.webpackJsonP=function(){if(webpackJsonP.l)webpackJsonP.p.push(arguments)};webpackJsonP.l=1;webpackJsonP.p=[];
```

### The plugin
```sh
npm install --save-dev multiple-commons-chunk-plugin
yarn install --dev multiple-commons-chunk-plugin
```

In `webpack.config.js`:

`MultipleCommonsChunkPlugin` constructor takes 4 arguments:


```js
var MultipleCommonsChunkPlugin = require('MultipleCommonsChunkPlugin');

// ...
plugins: [new BundleAnalyzerPlugin(
  // An array of entry bundle names (often the keys of the object passed as the `entry` option in webpack config)
  entryBundles,
  // An object where each entry (k,v) pair describes the chunk name and chunk config.
  // {
  // "common": {
  //   chunks: 'all' | []string // The chunks that depend on this common chunk. "all" is a special value that is equivalent to passing in `entryBundles`,  
  //   excludeChunks: []string, // a list of names that are removed from the `chunks` above
  //   minChunks: number | function | "polyfill" // the number and function options are described in webpack.CommonsChunkPluginOptions, "polyfill" is a special value that only applies wait/load behavior to this chunk
  // } }
  commonsChunkConfig,
  // A factory function to generate the filename option for webpack.CommonsChunkPluginOptions
  // e.g. (commonChunk) => `${commonChunk}.js`
  filenameCallback,
  // a path to write a json blob of script dependencies for your entry bundles
  // the output looks like: { "entryName" => ['commonChunk1', 'commonChunk2', ... ], ... }
  outputFilename,
)]
// ...
```


```js
// example config

const COMMON_CHUNKS_CONFIG = {
  // The home of the javascript that powers our site wide header
  // and includes common app code
  common: {
    // Which chunks should we make wait on the common bundle?
    // 'all' is a special value that means every entry bundle should QWait
    chunks: 'all',
    // An array of chunk names that we will exclude from the computed 'chunks' option
    // excludeChunks is mostly used to avoid "deadlocks" among common bundles
    // (hopefully we can automate this inside the plugin in the future)
    excludeChunks: [
      'i18n',
      'promise_polyfill',
      'react',
      'redux_and_immutable',
    ],
    // The normal minChunks value passed to webpack.CommonsChunkPlugin
    minChunks: 15,
  },
  // A common bundle that includes the node modules listed in the minChunks callback
  // This config is ready for tree shaking once we run node_modules through babel & webpack
  redux_and_immutable: {
    chunks: 'all',
    excludeChunks: ['ads', 'i18n', 'promise_polyfill', 'react'],
    minChunks: (module, counts) =>
      /node_modules\/(redux|react-redux|redux-actions|reselect|immutable|redux-thunk|redux-immutable)\//.test(
        module.resource
      ),
  },
  // Similar to the redux_and_immutable bundle but for react
  react: {
    chunks: 'all',
    excludeChunks: ['ads', 'i18n', 'promise_polyfill'],
    minChunks: (module, count) =>
      /node_modules\/(react|react-dom|react-overlays)\//.test(module.resource),
  },
  // A "polyfill" bundle that doesn't actually get passed to CommonsChunkPlugin
  // but allows us to QLoad/QWait properly if the user's browser is lacking
  i18n: {
    chunks: 'all',
    excludeChunks: ['promise_polyfill', 'react', 'redux_and_immutable'],
    minChunks: 'polyfill',
  },
};  

```


## Contributing

Open an issue or PR!

## License

[MIT](LICENSE)

[npm-url]: https://www.npmjs.com/package/webpack-bundle-analyzer
[npm-image]: https://img.shields.io/npm/v/multiple-commons-chunk-plugin.svg

