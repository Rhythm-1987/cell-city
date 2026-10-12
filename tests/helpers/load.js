"use strict";

/*
 * Loads the browser scripts that have no DOM dependency into this Node
 * process, so the unit tests exercise the very files the site ships. Scripts
 * run in the main realm (not a `vm` context) so their objects compare equal to
 * ordinary literals in assertions. Each call starts from a fresh `window`.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
  };
}

const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

/** Runs the given project files (relative paths) against a fresh `window` and returns its `CellCity`. */
function loadCellCity(files, { localStorage = memoryStorage(), prelude = "" } = {}) {
  const window = {};
  define("window", window);
  define("localStorage", localStorage);
  define("document", { querySelectorAll: () => [] });
  if (prelude) vm.runInThisContext(prelude, { filename: "prelude" });
  for (const file of files) vm.runInThisContext(fs.readFileSync(path.join(ROOT, file), "utf8"), { filename: file });
  return window.CellCity;
}

module.exports = { ROOT, loadCellCity, memoryStorage };
