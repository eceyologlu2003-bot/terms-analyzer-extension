const { defineConfig } = require("cypress");

module.exports = defineConfig({
  video: true,
  videoCompression: 32,
  videosFolder: 'cypress/videos',
  viewportWidth: 800,
  viewportHeight: 700,
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js'
  },
});
