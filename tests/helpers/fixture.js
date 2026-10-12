"use strict";

/*
 * Shared setup for the browser suites: one static server (plus a second one
 * that mimics a GitHub Pages project sub-path) and one headless browser per
 * test file. When no Edge/Chrome is installed the suites report themselves as
 * skipped instead of passing.
 */
const { launch, startServer, findBrowser } = require("./browser");

const available = Boolean(findBrowser());
const skip = available ? false : "no Edge/Chrome found (set EDGE_PATH to run browser tests)";

async function setup() {
  const server = await startServer();
  const subServer = await startServer({ prefix: "/Cell_City" });
  const browser = await launch();
  return {
    server,
    subServer,
    browser,
    /** Opens a fresh tab at a path under the root server, with the viewport set. */
    async open(pathname, { width = 1200, height = 900, reducedMotion = false, init, origin = server.origin, shareContextWith } = {}) {
      const page = await browser.newPage({ shareContextWith });
      await page.setViewport(width, height);
      await page.setReducedMotion(reducedMotion);
      if (init) await page.addInitScript(init);
      await page.goto(`${origin}/${pathname}`);
      return page;
    },
    async teardown() {
      await browser.close();
      await server.close();
      await subServer.close();
    },
  };
}

module.exports = { setup, skip };
