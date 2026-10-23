// Revisión local: Chrome abierto con --remote-debugging-port=9223 y cámara simulada.
import assert from "node:assert/strict";

const port = Number(process.env.CDP_PORT || 9223);
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = tabs.find((tab) => tab.type === "page" && tab.url.includes("127.0.0.1:5173"));
if (!page) throw new Error("No se encontró Vite en Chrome.");
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
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(check, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("Se agotó el tiempo de espera.");
}

try {
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Browser.setPermission", {
    origin: "http://127.0.0.1:5173",
    permission: { name: "camera" },
    setting: "denied",
  });
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("!document.querySelector('#cameraAction').hidden"));
  assert.equal(await evaluate("document.querySelector('#cameraAction').textContent"), "Permitir cámara");
  assert.match(await evaluate("document.querySelector('#cameraMessage').textContent"), /permiso/);

  await cdp("Browser.setPermission", {
    origin: "http://127.0.0.1:5173",
    permission: { name: "camera" },
    setting: "granted",
  });
  await evaluate("document.querySelector('#cameraAction').click()");
  await waitFor(() => evaluate("document.querySelector('#cameraPanel').hidden"));
  assert.equal(await evaluate("!!document.querySelector('#camera').srcObject"), true);

  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => evaluate("document.querySelector('#output').width === 1440 && document.querySelector('#output').height === 900"));
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => evaluate("document.querySelector('#output').width === 1920 && document.querySelector('#output').height === 1080"));
  assert.deepEqual(errors, []);
  console.log("Browser permission: denied, retry, resumed camera and desktop resize OK.");
} finally {
  await cdp("Browser.setPermission", {
    origin: "http://127.0.0.1:5173",
    permission: { name: "camera" },
    setting: "granted",
  });
  socket.close();
}
