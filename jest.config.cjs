const config = {
  verbose: true,
  transform: {},
  testEnvironment: "jsdom",
  testMatch: ["**/test/**/*.test.js"],
  setupFiles: ["<rootDir>/test/setup.js"],
  moduleNameMapper: {
    "^.*\\/d3\\.v7\\.js$": "<rootDir>/test/__mocks__/d3.v7.js",
    "^.*\\/deltae\\.global\\.min\\.js$":
      "<rootDir>/test/__mocks__/deltae.global.min.js",
    "^.*\\/underscore-min\\.js$": "<rootDir>/test/__mocks__/underscore-min.js",
  },
};

module.exports = config;
