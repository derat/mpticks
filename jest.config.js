module.exports = {
  preset: '@vue/cli-plugin-unit-jest/presets/typescript-and-babel',
  testMatch: ['**/*.test.[jt]s'],
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!vuetify/lib/util/colors.js)',
  ],
};
