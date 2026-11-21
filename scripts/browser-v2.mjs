import assert from 'node:assert/strict';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = tabs.find(tab => tab.type === 'page' && tab.url.includes('127.0.0.1:5173'));
if (!page) throw Error('Chrome tab unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once:true }));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.id && pending.has(message.id)) {
    const {resolve,reject} = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(Error(message.error.message)) : resolve(message.result);
  }
});
const cdp = (method,params={}) => new Promise((resolve,reject) => {
  const next = ++id; pending.set(next,{resolve,reject}); socket.send(JSON.stringify({id:next,method,params}));
});
async function evalJS(expression) {
  const data = await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (data.exceptionDetails) throw Error(data.exceptionDetails.text);
  return data.result.value;
}
async function waitFor(expression,timeout=32000) {
  const start=Date.now();
  while(Date.now()-start<timeout) {
    if(await evalJS(expression)) return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error(`Timeout: ${expression}`);
}
async function shot(name) {
  await mkdir('qa/v2',{recursive:true});
  const {data}=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`qa/v2/${name}.png`,Buffer.from(data,'base64'));
}
async function setViewport(width,height) {
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<701});
  await new Promise(resolve=>setTimeout(resolve,350));
}
async function waitElapsed(startedAt, targetMs) {
  const elapsed = await evalJS('performance.now()') - startedAt;
  await new Promise(resolve => setTimeout(resolve, Math.max(0, targetMs - elapsed)));
}
try {
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await setViewport(1920,1080);
  await cdp('Page.reload');
  await waitFor("!document.querySelector('#cameraPanel').hidden");
  await shot('desktop-permission');
  assert.equal(await evalJS("document.querySelector('#cameraAction').textContent"),'Permitir cámara');
  await setViewport(390,844);
  await shot('mobile-permission');
  await setViewport(1920,1080);
  await evalJS("document.querySelector('#cameraAction').click()");
  await waitFor("!document.querySelector('#cameraControls').hidden");
  const cameraStartedAt = await evalJS('performance.now()');
  await new Promise(resolve=>setTimeout(resolve,1500));
  await shot('desktop-camera');
  await mkdir('qa/v2/downloads',{recursive:true});
  const previousDownloads = (await readdir('qa/v2/downloads')).length;
  await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:`${process.cwd()}/qa/v2/downloads`});
  await evalJS("document.querySelector('#saveButton').click()");
  await waitFor("document.querySelector('#cameraControls').hidden === false");
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.ok((await readdir('qa/v2/downloads')).filter(name => name.endsWith('.png')).length > previousDownloads);
  await waitElapsed(cameraStartedAt, 5500);
  await shot('desktop-camera-random-v22');
  await waitElapsed(cameraStartedAt, 19000);
  await shot('desktop-camera-collage-v22');
  await waitElapsed(cameraStartedAt, 22400);
  await shot('desktop-camera-negative-v22');
  assert.equal(await evalJS("document.querySelector('#camera').srcObject"), null);
  await waitFor("!document.querySelector('#postShell').hidden",32000);
  const elapsedToQuest = await evalJS('performance.now()') - cameraStartedAt;
  assert.ok(elapsedToQuest >= 23700 && elapsedToQuest < 26000, `Camera duration ${elapsedToQuest} ms`);
  assert.equal(await evalJS("document.querySelector('#camera').srcObject"),null);
  assert.ok(await evalJS("document.querySelector('#capturedBackground').style.backgroundImage.length > 100"));
  await shot('desktop-quest');
  const initialFrame = await evalJS("document.querySelector('.gen-frame path').getAttribute('d')");
  for (const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[360,800]]) {
    await setViewport(width,height);
    assert.ok(await evalJS("document.documentElement.scrollWidth <= innerWidth"));
    assert.ok(await evalJS("[...document.querySelectorAll('#questionForm button')].every(button => { const r=button.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight; })"));
    await shot(`quest-${width}x${height}`);
  }
  await setViewport(1920,1080);
  assert.equal(await evalJS("document.querySelector('.gen-frame path').getAttribute('d')"),initialFrame);
  await evalJS("document.querySelector('#answer').value='Quiero imaginar otro futuro'; document.querySelector('#questionForm').requestSubmit()");
  await waitFor("!document.querySelector('#archiveView').hidden");
  await waitFor("document.querySelectorAll('.archive-panel').length === 10");
  await shot('desktop-replies');
  assert.ok(await evalJS("[...document.querySelectorAll('.archive-panel')].every(panel => panel.style.visibility === 'visible')"));
  await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:960,y:540,deltaY:350,deltaX:0});
  await waitFor("Number(document.querySelector('#archiveCoordinates').textContent.split('Z ')[1]) > 0");
  await setViewport(390,844);
  await waitFor("document.querySelector('#archiveViewport').hidden");
  assert.equal(await evalJS("document.querySelectorAll('.mobile-reply').length"),10);
  await setViewport(1920,1080);
  await waitFor("!document.querySelector('#archiveViewport').hidden");
  await evalJS("document.querySelector('#aboutButton').click()");
  await waitFor("!document.querySelector('#aboutLayer').hidden");
  assert.ok(await evalJS("document.querySelectorAll('#aboutOrnament use').length > 100"));
  await shot('desktop-modal');
  await evalJS("document.querySelector('#aboutVideo').click()");
  await waitFor("!document.querySelector('#videoView').hidden");
  await waitFor("document.querySelector('#artVideo').readyState >= 2");
  await shot('desktop-video');
  await evalJS("document.querySelector('#videoClose').click()");
  await waitFor("!document.querySelector('#questionView').hidden");
  await evalJS("document.querySelector('#aboutButton').focus(); document.querySelector('#aboutButton').click()");
  await waitFor("!document.querySelector('#aboutLayer').hidden");
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await waitFor("document.querySelector('#aboutLayer').hidden");
  assert.equal(await evalJS("document.activeElement.id"),'aboutButton');
  await setViewport(390,844);
  await shot('mobile-quest');
  await evalJS("document.querySelector('#exitButton').click()");
  await waitFor("!document.querySelector('#archiveView').hidden");
  assert.equal(await evalJS("document.querySelector('#archiveViewport').hidden"),true);
  assert.equal(await evalJS("document.querySelectorAll('.mobile-reply').length"),10);
  await evalJS("document.querySelector('#mobileReplies').scrollTop=160");
  assert.ok(await evalJS("document.querySelector('#mobileReplies').scrollTop > 0"));
  await shot('mobile-replies');
  await evalJS("document.querySelector('#aboutButton').click()");
  await shot('mobile-modal');
  await evalJS("document.querySelector('#aboutVideo').click()");
  await waitFor("!document.querySelector('#videoView').hidden");
  await waitFor("document.querySelector('#artVideo').readyState >= 2");
  await shot('mobile-video');
  await evalJS("document.querySelector('#videoClose').click(); document.querySelector('#backButton').click()");
  await waitFor("!document.querySelector('#cameraControls').hidden");
  await shot('mobile-camera');
  await evalJS("document.querySelector('#skipButton').click()");
  await waitFor("!document.querySelector('#questionView').hidden");
  assert.ok(await evalJS("document.querySelector('#capturedBackground').style.backgroundImage.length > 100"));
  const deniedScript = await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) });"});
  await cdp('Page.reload');
  await waitFor("!document.querySelector('#cameraPanel').hidden");
  await evalJS("document.querySelector('#cameraAction').click()");
  await waitFor("document.querySelector('#cameraMessage').textContent.includes('configuración')",10000);
  await shot('desktop-permission-denied');
  await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:deniedScript.identifier});
  assert.deepEqual(errors,[]);
  console.log(`Browser V2.2 flow passed in ${Math.round(elapsedToQuest)} ms; screenshots in qa/v2`);
} finally {socket.close();}
