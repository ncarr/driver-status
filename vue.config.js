module.exports = {
  pwa: {
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: './worker/sw.ts',
      swDest: 'service-worker.js'
    }
  },
  // Quick hack to fix problem with workbox-webpack-plugin
  productionSourceMap: false
}