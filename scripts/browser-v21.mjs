import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = tabs.find(tab => tab.type === 'page' && tab.url.includes('127.0.0.1:5173'));
if (!page) throw Error('Chrome tab unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
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
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
}
async function shot(name) {
  await mkdir('qa/v21', { recursive: true });
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`qa/v21/${name}.png`, Buffer.from(data, 'base64'));
}
async function viewport(width, height) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 700 });
  await new Promise(resolve => setTimeout(resolve, 300));
}
try {
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await viewport(1920, 1080);
  await cdp('Page.reload');
  await waitFor("!document.querySelector('#cameraPanel').hidden");
  await evaluate("document.querySelector('#cameraAction').click()");
  await waitFor("!document.querySelector('#cameraControls').hidden");
  await evaluate("document.querySelector('#skipButton').click()");
  await waitFor("!document.querySelector('#postShell').hidden");
  assert.equal(await evaluate("document.querySelector('#questionHeading').getAttribute('aria-label')"), '¿Qué existe en el futuro que imaginas?');
  assert.ok(await evaluate("document.querySelectorAll('#questionHeading .experimental-word').length > 3"));
  assert.ok(await evaluate("new Set([...document.querySelectorAll('#questionHeading .experimental-word > span')].map(node => node.style.transform)).size > 1"));
  assert.ok(await evaluate("document.querySelectorAll('.gen-lineframe use').length > 100"));
  const button = await evaluate("(() => { const r = document.querySelector('#sendButton').getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()");
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...button });
  await new Promise(resolve => setTimeout(resolve, 230));
  assert.match(await evaluate("getComputedStyle(document.querySelector('#sendButton span')).transform"), /^matrix\(2,/);
  await shot('desktop-quest');
  await evaluate("document.querySelector('#answer').value='Nueva respuesta'; document.querySelector('#questionForm').requestSubmit()");
  await waitFor("!document.querySelector('#archiveView').hidden");
  await waitFor("document.querySelectorAll('.archive-panel').length === 10");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.archive-panel:first-child .experimental-word > span')].slice(0,2).map(node => node.textContent)"), ['Nueva', 'respuesta']);
  assert.ok(await evaluate("document.querySelector('.archive-panel').getBoundingClientRect().width > 0"));
  await shot('desktop-replies');
  await evaluate("document.querySelector('#aboutButton').click()");
  await waitFor("!document.querySelector('#aboutLayer').hidden");
  assert.equal(await evaluate("document.querySelectorAll('#aboutOrnament .corner-bridge').length"), 8);
  await shot('desktop-about');
  await evaluate("document.querySelector('#aboutVideo').click()");
  await waitFor("!document.querySelector('#videoView').hidden && document.querySelector('#artVideo').readyState >= 2");
  await waitFor("document.querySelector('#artVideo').currentTime > .5");
  assert.ok(await evaluate("parseFloat(document.querySelector('#videoProgress').style.width) > 0"));
  await evaluate("document.querySelector('#artVideo').pause()");
  const paused = await evaluate("parseFloat(document.querySelector('#videoProgress').style.width)");
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(await evaluate("parseFloat(document.querySelector('#videoProgress').style.width)"), paused);
  await evaluate("document.querySelector('#artVideo').currentTime = 10");
  await waitFor("Math.abs(parseFloat(document.querySelector('#videoProgress').style.width) - 10 / 88.44 * 100) < .5");
  assert.equal(await evaluate("document.querySelector('#videoTimeline').getAttribute('aria-valuenow')"), '11');
  await evaluate("document.querySelector('#videoClose').click()");
  await viewport(1024, 768);
  await shot('tablet-quest');
  await viewport(390, 844);
  await evaluate("document.querySelector('#exitButton').click()");
  await waitFor("!document.querySelector('#archiveView').hidden");
  assert.equal(await evaluate("document.querySelector('.mobile-reply').textContent"), 'Nueva respuesta');
  await shot('mobile-replies');
  await evaluate("document.querySelector('#aboutButton').click()");
  await shot('mobile-about');
  await evaluate("document.querySelector('#aboutVideo').click()");
  await waitFor("!document.querySelector('#videoView').hidden && document.querySelector('#artVideo').currentTime > 10");
  assert.ok(await evaluate("parseFloat(document.querySelector('#videoProgress').style.width) > 10"));
  await shot('mobile-video');
  await evaluate("document.querySelector('#videoClose').click()");
  await waitFor("!document.querySelector('#questionView').hidden");
  await evaluate("document.querySelector('#aboutButton').click(); document.querySelector('#aboutVideo').click()");
  await waitFor("!document.querySelector('#videoView').hidden");
  assert.ok(await evaluate("parseFloat(document.querySelector('#videoProgress').style.width) > 0"));
  await evaluate("document.querySelector('#videoClose').click()");
  for (const [width, height, name] of [[1440, 900, 'desktop-1440'], [768, 1024, 'tablet-portrait'], [360, 800, 'mobile-360']]) {
    await viewport(width, height);
    await evaluate("document.querySelector('#aboutButton').click()");
    const bounds = await evaluate("(() => { const r=document.querySelector('.about-dialog').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollHeight:document.querySelector('.about-dialog').scrollHeight,clientHeight:document.querySelector('.about-dialog').clientHeight}; })()");
    assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= height, `${name}: modal viewport bounds`);
    assert.ok(bounds.scrollHeight <= bounds.clientHeight + 1, `${name}: modal content fits without scroll`);
    await shot(name + '-about');
    await evaluate("document.querySelector('#aboutClose').click()");
  }
  assert.deepEqual(errors, []);
  console.log('V2.1 browser checks passed');
} finally { socket.close(); }
