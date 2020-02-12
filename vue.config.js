// Define a variable containing the git commit:
// https://stackoverflow.com/a/38401256/6882947
// https://cli.vuejs.org/guide/mode-and-env.html
//
// Note that this does not dynamically update under "npm run serve".
process.env.VUE_APP_GIT_COMMIT = require('child_process')
  .execSync('git rev-parse HEAD')
  .toString()
  .trim();

module.exports = {
  transpileDependencies: ['vuetify'],
};
