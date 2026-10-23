// Revisión local sin dependencias: Chrome debe estar abierto con --remote-debugging-port=9223.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const port = Number(process.env.CDP_PORT || 9223);
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = tabs.find((tab) => tab.type === "page" && tab.url.includes("127.0.0.1:5173"));
if (!page) throw new Error("No se encontró la página local de Vite en Chrome.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    browserErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
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
async function waitFor(check, timeout = 28000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Tiempo de espera agotado. Estado: ${JSON.stringify(await evaluate(`({camera:document.querySelector('#cameraPanel').innerText,question:document.querySelector('#questionView').hidden,archive:document.querySelector('#archiveView').hidden})`))}`);
}
async function rect(selector) {
  return evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
}
async function click(selector) {
  const { x, y } = await rect(selector);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function shot(name) {
  await mkdir("qa", { recursive: true });
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`qa/${name}.png`, Buffer.from(data, "base64"));
}

try {
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await waitFor(async () => evaluate("!document.querySelector('#questionView').hidden && !document.querySelector('#postShell').hidden"));
  assert.equal(await evaluate("document.querySelector('#camera').srcObject"), null);
  assert.equal(await evaluate("document.querySelector('#answer').maxLength"), 333);
  assert.equal(await evaluate("!!document.querySelector('#mainLogo svg')"), true);
  await shot("question");

  const aboutPoint = await rect("#aboutButton");
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...aboutPoint });
  await new Promise((resolve) => setTimeout(resolve, 230));
  assert.match(await evaluate("getComputedStyle(document.querySelector('#aboutButton span')).transform"), /^matrix\(2,/);
  await evaluate("document.querySelector('#answer').focus()");
  await cdp("Input.insertText", { text: "a".repeat(340) });
  assert.equal(await evaluate("document.querySelector('#answer').value.length"), 333);

  await click("#aboutButton");
  assert.equal(await evaluate("document.querySelector('#aboutLayer').hidden"), false);
  assert.equal(await evaluate("document.querySelector('#sceneShell').classList.contains('is-obscured')"), true);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement.id"), "aboutClose");
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await shot("about");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate("document.querySelector('#aboutLayer').hidden"), true);
  assert.equal(await evaluate("document.activeElement.id"), "aboutButton");
  assert.equal(await evaluate("document.querySelector('#answer').value.length"), 333);
  await evaluate("document.querySelector('#answer').value = ''");

  await click("#sendButton");
  assert.equal(await evaluate("document.querySelector('#confirmation').textContent"), "Mensaje enviado (simulación)");
  await click("#aboutButton");
  await new Promise((resolve) => setTimeout(resolve, 1350));
  assert.equal(await evaluate("document.querySelector('#questionView').hidden"), false);
  assert.equal(await evaluate("document.querySelector('#aboutLayer').hidden"), false);
  await click("#aboutClose");
  await waitFor(async () => evaluate("!document.querySelector('#archiveView').hidden"), 3500);
  await waitFor(async () => evaluate("document.querySelectorAll('.archive-panel').length === 9"), 3500);
  await shot("archive");
  await cdp("Input.dispatchMouseEvent", { type: "mouseWheel", x: 980, y: 530, deltaX: 0, deltaY: 600 });
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(Number((await evaluate("document.querySelector('#archiveCoordinates').textContent")).match(/Z (\d+)/)[1]) > 0);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: 900, y: 500, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1080, y: 590, buttons: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1080, y: 590, button: "left", clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const beforeAbout = await evaluate("document.querySelector('#archiveCoordinates').textContent");
  assert.notEqual(Number(beforeAbout.match(/X (-?\d+)/)[1]), 0);
  await click("#aboutButton");
  await click("#aboutClose");
  assert.equal(await evaluate("document.querySelector('#archiveCoordinates').textContent"), beforeAbout);
  await click("#mainLogo");
  await waitFor(async () => evaluate("document.querySelector('#postShell').hidden"), 2000);
  await waitFor(async () => evaluate("document.querySelector('#cameraPanel').hidden"), 5000);
  await new Promise((resolve) => setTimeout(resolve, 6000));
  await shot("mosaic");
  await new Promise((resolve) => setTimeout(resolve, 6000));
  await shot("collage");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await shot("inversion");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await shot("overexposure");
  await waitFor(async () => evaluate("!document.querySelector('#questionView').hidden"), 3000);
  assert.deepEqual(browserErrors, []);
  console.log("Browser smoke: camera sequence, question, About, empty submit, archive XYZ and restart OK.");
} finally {
  socket.close();
}
