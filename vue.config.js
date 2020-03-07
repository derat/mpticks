// Define a variable containing the git commit:
// https://stackoverflow.com/a/38401256/6882947
// https://cli.vuejs.org/guide/mode-and-env.html
//
// Note that this does not dynamically update under "npm run serve".
process.env.VUE_APP_GIT_COMMIT = require('child_process')
  .execSync('git rev-parse HEAD')
  .toString()
  .trim();

const appName = process.env.VUE_APP_NAME || 'mpticks';

module.exports = {
  pwa: {
    name: appName,
    manifestPath: 'manifest.json',
    manifestOptions: {
      name: appName,
      short_name: appName,
      icons: [
        {
          src: '/maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/favicon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/favicon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
      theme_color: '#3f51b5',
      background_color: '#3f51b5',
      start_url: '/index.html',
      scope: '/',
      display: 'standalone',
    },
    workboxOptions: {
      // Serve the index for non-precached URLs.
      navigateFallback: '/index.html',
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
          handler: 'CacheFirst',
          method: 'GET',
        },
      ],
    },
    // We could just declare all of the following values ourselves in
    // public/index.html, but cli-plugin-pwa insists on inserting them itself.
    themeColor: '#3f51b5',
    iconPaths: {
      appleTouchIcon: 'apple-touch-icon.png',
      favicon16: 'favicon-16x16.png',
      favicon32: 'favicon-32x32.png',
      // maskIcon and msTileImage have dumb default values that will end up in
      // index.html, but I don't care enough about Macbook touchbars or Metro
      // tiles to bother generating images.
    },
  },
  transpileDependencies: ['vuetify'],
};
