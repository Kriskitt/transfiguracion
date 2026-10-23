// Chrome: --remote-debugging-port=9226 --use-fake-ui-for-media-stream --use-fake-device-for-media-stream
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const port = Number(process.env.CDP_PORT || 9226);
const origin = process.env.PREVIEW_ORIGIN || "http://127.0.0.1:4175";
const prefix = "/transfiguracion/";
const publicSite = origin.startsWith("https://");
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = tabs.find((tab) => tab.type === "page" && tab.url.startsWith(`${origin}${prefix}`));
if (!page) throw new Error("No se encontró la vista previa de Pages en Chrome.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  }
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    errors.push(`${message.params.response.status} ${message.params.response.url}`);
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(check, timeout = 26000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Se agotó el tiempo. Errores: ${JSON.stringify(errors)}`);
}
async function click(selector) {
  const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}

try {
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("La recarga de la página no terminó.")), 15000);
    const onMessage = (event) => {
      if (JSON.parse(event.data).method !== "Page.loadEventFired") return;
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve();
    };
    socket.addEventListener("message", onMessage);
  });
  await cdp("Page.reload", { ignoreCache: true });
  await loaded;
  assert.equal(await evaluate("location.pathname"), prefix);
  assert.equal(await evaluate("document.querySelector('#cameraAction').hidden"), false);
  assert.equal(await evaluate("document.querySelector('#cameraAction').textContent"), "Permitir cámara");
  assert.equal(await evaluate("document.querySelector('#camera').srcObject"), null);
  await click("#cameraAction");
  await waitFor(() => evaluate("document.querySelector('#cameraPanel').hidden"), 10000);
  assert.equal(await evaluate("!!document.querySelector('#camera').srcObject"), true);
  await waitFor(() => evaluate("!document.querySelector('#postShell').hidden && !document.querySelector('#questionView').hidden"), 26000);
  assert.equal(await evaluate("document.querySelector('#camera').srcObject"), null);
  assert.equal(await evaluate("document.querySelector('#answer').maxLength"), 333);
  assert.deepEqual(await evaluate("Promise.all(['HaasLight','HaasRoman','HaasMedium'].map(f => document.fonts.load('24px '+f))).then(() => ['HaasLight','HaasRoman','HaasMedium'].map(f => document.fonts.check('24px '+f)))"), [true, true, true]);
  await mkdir("qa", { recursive: true });
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`qa/pages-${publicSite ? "public" : "local"}-question.png`, Buffer.from(data, "base64"));
  await click("#archiveButton");
  await waitFor(() => evaluate("!document.querySelector('#archiveView').hidden"), 5000);
  await click("#aboutButton");
  assert.equal(await evaluate("document.querySelector('#aboutLayer').hidden"), false);
  await click("#aboutClose");
  assert.equal(await evaluate("document.querySelector('#archiveCoordinates').textContent.includes('Z ')"), true);
  assert.deepEqual(errors, []);
  console.log(`Pages ${publicSite ? "public site" : "preview"}: prefix, consent, camera lifecycle, fonts, question, archive, About, network and console OK.`);
} finally {
  socket.close();
}
