"use strict";

/*
 * Minimal headless-Edge driver using the Chrome DevTools Protocol over the
 * WebSocket built into Node 22+. No npm packages: a static file server for the
 * repo, an Edge launcher, and a small Page wrapper (evaluate, keyboard,
 * viewport, console / network capture).
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { ROOT } = require("./load");

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const findBrowser = () => EDGE_CANDIDATES.find((p) => fs.existsSync(p)) || null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Serves the repo. With `prefix` ("/Cell_City") it behaves like a GitHub Pages project site. */
function startServer({ prefix = "" } = {}) {
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (prefix) {
      if (!pathname.startsWith(prefix + "/")) {
        res.writeHead(404).end("outside project prefix");
        return;
      }
      pathname = pathname.slice(prefix.length);
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.join(ROOT, pathname);
    // Case-sensitive like GitHub Pages: refuse a request whose spelling differs from the file on disk.
    const exact = file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile() &&
      path.relative(ROOT, file).split(path.sep).every((part, i, parts) =>
        fs.readdirSync(path.join(ROOT, ...parts.slice(0, i))).includes(part));
    if (!exact) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ origin: `http://127.0.0.1:${port}${prefix}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.consoleProblems = []; // console errors/warnings, uncaught exceptions, browser-logged errors
    this.failedRequests = []; // network failures and HTTP >= 400
    this.consoleLog = [];
    this.dialogs = []; // messages of alert/confirm dialogs, which are answered automatically
    this.acceptDialogs = true;
    ws.addEventListener("message", (event) => this.#onMessage(JSON.parse(event.data)));
    this.on("Runtime.consoleAPICalled", (e) => {
      const text = e.args.map((a) => a.value ?? a.description ?? "").join(" ");
      this.consoleLog.push(`${e.type}: ${text}`);
      if (e.type === "error" || e.type === "warning") this.consoleProblems.push(`console.${e.type}: ${text}`);
    });
    this.on("Runtime.exceptionThrown", (e) => this.consoleProblems.push(`exception: ${e.exceptionDetails.exception?.description || e.exceptionDetails.text}`));
    this.on("Log.entryAdded", (e) => {
      // Edge's Tracking Prevention comments on the Bootstrap CDN's storage access; it says nothing about this site.
      if (/Tracking Prevention blocked access to storage/.test(e.entry.text)) return;
      if (e.entry.level === "error" || e.entry.level === "warning") this.consoleProblems.push(`log.${e.entry.level}: ${e.entry.text} ${e.entry.url || ""}`);
    });
    this.on("Page.javascriptDialogOpening", (e) => {
      this.dialogs.push(e.message);
      this.send("Page.handleJavaScriptDialog", { accept: this.acceptDialogs });
    });
    this.on("Network.loadingFailed", (e) => {
      if (!e.canceled) this.failedRequests.push(`failed: ${e.errorText} (${e.requestId})`);
    });
    this.on("Network.responseReceived", (e) => {
      if (e.response.status >= 400) this.failedRequests.push(`${e.response.status} ${e.response.url}`);
    });
  }

  #onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data || "")})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const handler of this.handlers.get(msg.method) || []) handler(msg.params);
    }
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async init() {
    await Promise.all(["Page", "Runtime", "Log", "Network"].map((d) => this.send(`${d}.enable`)));
    await this.send("Network.setCacheDisabled", { cacheDisabled: true });
  }

  clearProblems() {
    this.consoleProblems.length = 0;
    this.failedRequests.length = 0;
    this.consoleLog.length = 0;
  }

  async setViewport(width, height = 900) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  }

  async setReducedMotion(reduce) {
    await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
  }

  /** Script that runs before any page script on every navigation (e.g. to block localStorage). */
  async addInitScript(source) {
    await this.send("Page.addScriptToEvaluateOnNewDocument", { source });
  }

  async goto(url, { waitForBootstrap = true } = {}) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", { timeout: 20000 });
    if (waitForBootstrap) await this.waitFor("typeof window.bootstrap !== 'undefined'", { timeout: 20000 });
  }

  /** Evaluates an expression in the page and returns its JSON value. */
  async eval(expression) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (exceptionDetails) throw new Error(`eval failed: ${exceptionDetails.exception?.description || exceptionDetails.text}\n${expression.slice(0, 300)}`);
    return result.value;
  }

  async waitFor(expression, { timeout = 5000, interval = 40 } = {}) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
      try {
        last = await this.eval(expression);
        if (last) return last;
      } catch (error) {
        last = error.message;
      }
      await sleep(interval);
    }
    throw new Error(`timed out after ${timeout}ms waiting for: ${expression}\n(last value: ${JSON.stringify(last)})`);
  }

  /** Real keyboard input (goes through the browser's focus and default-action handling). */
  async press(key, { shift = false } = {}) {
    const keys = {
      Tab: { code: "Tab", vk: 9 },
      Enter: { code: "Enter", vk: 13, text: "\r" },
      " ": { code: "Space", vk: 32, text: " " },
      Escape: { code: "Escape", vk: 27 },
      ArrowRight: { code: "ArrowRight", vk: 39 },
      ArrowLeft: { code: "ArrowLeft", vk: 37 },
    };
    const k = keys[key];
    if (!k) throw new Error(`unsupported key ${key}`);
    await this.send("Page.bringToFront");
    const base = { key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers: shift ? 8 : 0 };
    await this.send("Input.dispatchKeyEvent", { type: k.text ? "keyDown" : "rawKeyDown", ...base, text: k.text });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }

  /** Real mouse click at viewport coordinates. */
  async clickAt(x, y) {
    await this.send("Page.bringToFront"); // background tabs are throttled and slow to take input
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  /** Scrolls the element into view and clicks its centre with the real mouse. */
  async click(selector) {
    const point = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!point) throw new Error(`click: nothing matches ${selector}`);
    await this.clickAt(point.x, point.y);
  }

  /** Replaces the value of a field by typing, so input events fire as they do for a user. */
  async fill(selector, text) {
    await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select && el.select(); })()`);
    if (text === "") await this.eval(`(() => { const el = document.activeElement; el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    else await this.type(text);
  }

  /** Types text into the focused element as real key input. */
  async type(text) {
    await this.send("Input.insertText", { text });
  }

  async close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

async function launch() {
  const exe = findBrowser();
  if (!exe) return null;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellcity-edge-"));
  const child = spawn(
    exe,
    ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
      "--remote-debugging-port=0", `--user-data-dir=${userDataDir}`, "about:blank"],
    { stdio: "ignore" }
  );
  const portFile = path.join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + 20000;
  while (!fs.existsSync(portFile)) {
    if (Date.now() > deadline) throw new Error("browser did not start");
    await sleep(100);
  }
  await sleep(200);
  const port = Number(fs.readFileSync(portFile, "utf8").split("\n")[0]);

  const pages = [];
  const portLines = fs.readFileSync(portFile, "utf8").split("\n");
  const browserWs = new WebSocket(`ws://127.0.0.1:${port}${portLines[1]}`);
  await new Promise((resolve, reject) => {
    browserWs.addEventListener("open", resolve, { once: true });
    browserWs.addEventListener("error", reject, { once: true });
  });
  const browserPage = new Page(browserWs); // only used for browser-level (Target.*) commands

  return {
    exe,
    /**
     * Opens a tab in its own incognito-style context, so localStorage never leaks between tests.
     * Pass `shareContextWith: otherPage` to open a second tab that shares storage with it.
     */
    async newPage({ shareContextWith } = {}) {
      const contextId = shareContextWith
        ? shareContextWith.contextId
        : (await browserPage.send("Target.createBrowserContext")).browserContextId;
      const { targetId } = await browserPage.send("Target.createTarget", { url: "about:blank", browserContextId: contextId });
      const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
      await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, { once: true });
        ws.addEventListener("error", reject, { once: true });
      });
      const page = new Page(ws);
      page.targetId = targetId;
      page.contextId = contextId;
      await page.init();
      pages.push(page);
      return page;
    },
    async closePage(page) {
      await page.close();
      await browserPage.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
    },
    async close() {
      for (const page of pages) await page.close();
      await browserPage.close();
      child.kill();
      await sleep(300);
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

module.exports = { launch, startServer, findBrowser, sleep };
