import assert from 'node:assert/strict';

const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:4173';
const cdpPort = Number(process.env.CDP_PORT || 9226);
const pageUrl = `${origin}/transfiguracion/`;
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const page = tabs.find(tab => tab.type === 'page' && tab.url.startsWith(pageUrl));
if (!page) throw Error(`Chrome tab missing: ${pageUrl}`);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
    errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400)
    errors.push(`${message.params.response.status} ${message.params.response.url}`);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(Error(message.error.message)) : resolve(message.result);
  }
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  socket.send(JSON.stringify({ id: next, method, params }));
});
async function evaluate(expression) {
  const data = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (data.exceptionDetails) throw Error(data.exceptionDetails.text);
  return data.result.value;
}
async function waitFor(expression, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw Error(`Timed out: ${expression}; ${errors.join('; ')}`);
}
async function click(selector) {
  const point = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
try {
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.reload', { ignoreCache: true });
  await waitFor("!document.querySelector('#cameraPanel').hidden");
  assert.equal(await evaluate('location.pathname'), '/transfiguracion/');
  assert.equal(await evaluate('window.isSecureContext'), true);
  assert.equal(await evaluate("document.querySelector('#camera').srcObject"), null);
  await click('#cameraAction');
  await waitFor("!document.querySelector('#cameraControls').hidden");
  assert.ok(await evaluate("document.querySelector('#camera').srcObject?.getVideoTracks().length === 1"));
  await click('#skipButton');
  await waitFor("!document.querySelector('#postShell').hidden");
  assert.equal(await evaluate("document.querySelector('#camera').srcObject"), null);
  assert.ok(await evaluate("document.querySelectorAll('.gen-lineframe use').length > 100"));
  assert.ok(await evaluate("document.querySelectorAll('#questionHeading .experimental-word').length > 3"));
  await evaluate("document.querySelector('#answer').value='Pages V2.1'; document.querySelector('#questionForm').requestSubmit()");
  await waitFor("!document.querySelector('#archiveView').hidden");
  assert.ok(await evaluate("document.querySelector('.archive-panel:first-child').textContent.includes('Pages')"));
  await click('#aboutButton');
  await waitFor("!document.querySelector('#aboutLayer').hidden");
  assert.equal(await evaluate("document.querySelectorAll('#aboutOrnament .corner-bridge').length"), 8);
  await click('#aboutVideo');
  await waitFor("!document.querySelector('#videoView').hidden && document.querySelector('#artVideo').readyState >= 2");
  if (await evaluate("document.querySelector('#artVideo').paused")) await click('#videoPlay');
  await waitFor("document.querySelector('#artVideo').currentTime > .5");
  assert.ok(await evaluate("parseFloat(document.querySelector('#videoProgress').style.width) > 0"));
  await click('#videoClose');
  await waitFor("!document.querySelector('#questionView').hidden");
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('#exitButton');
  await waitFor("!document.querySelector('#archiveView').hidden");
  assert.ok(await evaluate("document.querySelector('.mobile-reply').textContent.startsWith('Pages V2.1')"));
  await click('#aboutButton');
  assert.equal(await evaluate("document.querySelector('#aboutLayer').hidden"), false);
  assert.deepEqual(errors, []);
  console.log(`Pages V2.1 browser checks passed: ${pageUrl}`);
} finally { socket.close(); }
