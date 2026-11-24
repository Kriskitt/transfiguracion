import './styles.css';
import abstractLogoUrl from '../rsc_/trans_abstractlogo.svg?url';
import { CameraController } from './camera.js';
import { FINAL_EXPOSURE, RESPONSE_MAX_LENGTH } from './config.js';
import { CompositionController } from './composition.js';
import { renderGenerativeLayers, renderOrnament } from './effects/generative.js';
import { createRandom, createRunSeed, createSeedFromQuery } from './random.js';
import { WebGLRenderer } from './renderer.js';
import { AppState } from './state.js';
import { buildCameraSequence, getStageAt, Timeline } from './timeline.js';
import { InterfaceController } from './ui.js';
import { AboutView } from './views/about.js';
import { ArchiveView } from './views/archive.js';
import { installQuestionDrag } from './views/question-drag.js';
import { QuestionTitles } from './views/question-titles.js';
import { VideoView } from './views/video.js';
import { ReplyRepository } from './data/replies.js';
import { renderFinalFrame } from './final-frame.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#output');
const video = $('#camera');
const sceneShell = $('#sceneShell');
const postShell = $('#postShell');
const questionView = $('#questionView');
const questionHeading = $('#questionHeading span');
const questionTitles = new QuestionTitles(questionHeading);
const questionDrag = installQuestionDrag($('#questionForm'));
const archiveRoot = $('#archiveView');
const controls = $('#cameraControls');
const answer = $('#answer');
const ui = new InterfaceController($('#cameraPanel'), $('#cameraMessage'), $('#cameraAction'));
const state = new AppState();
const camera = new CameraController(video);
const timeline = new Timeline();
const repository = new ReplyRepository();
const querySeed = createSeedFromQuery();
const about = new AboutView($('#aboutLayer'), createRandom(`${querySeed ?? 'about'}:about`), closeAbout);
const videoView = new VideoView($('#videoView'), leaveVideo);
let renderer = null;
let composition = null;
let archive = null;
let animationFrame = 0;
let runToken = 0;
let runSeed = '';
let sequence = [];
let frozenVideoSize = null;
let submissionNumber = 0;
let savedBackground = '';
let resizeTimer = 0;

const mainLogo = $('#mainLogo');
mainLogo.innerHTML = `<img src="${abstractLogoUrl}" alt="" />`;
new ResizeObserver(([entry]) => {
  if (entry.contentRect.height) $('.global-nav').style.height = `${entry.contentRect.height}px`;
}).observe(mainLogo);

function stopLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function disposeArchive() {
  archive?.dispose();
  archive = null;
  archiveRoot.hidden = true;
}

function resetPostInterface() {
  questionTitles.stop();
  if (state.aboutOpen) closeAbout();
  disposeArchive();
  postShell.hidden = true;
  questionView.hidden = false;
  answer.value = '';
  $('#confirmation').textContent = '';
  $('#sendButton').disabled = false;
  $('#archiveButton').removeAttribute('aria-current');
  postShell.classList.remove('is-archive');
  $('#capturedBackground').style.backgroundImage = '';
  sceneShell.classList.remove('has-capture');
  savedBackground = '';
}

function showPermission(message = 'Para comenzar, permite el uso de tu cámara.', label = 'Permitir cámara') {
  controls.hidden = true;
  if (state.current !== 'camera_idle') state.transition('camera_idle');
  ui.showRetry(message, label);
}

async function startExperience() {
  const token = ++runToken;
  stopLoop();
  resetPostInterface();
  camera.stop();
  timeline.stop();
  composition = null;
  frozenVideoSize = null;
  controls.hidden = true;
  if (state.current !== 'camera_idle') state.transition('camera_idle');
  state.transition('camera_permission');
  ui.showPending();
  try {
    if (!renderer) renderer = new WebGLRenderer(canvas);
    await camera.start();
    if (token !== runToken) return;
    runSeed = createRunSeed(querySeed);
    composition = new CompositionController(createRandom(`${runSeed}:camera`));
    sequence = buildCameraSequence(createRandom(`${runSeed}:sequence`));
    timeline.start(performance.now());
    state.transition('camera_running');
    ui.hide();
    controls.hidden = false;
    animationFrame = requestAnimationFrame(renderLoop);
  } catch (error) {
    if (token !== runToken || error?.code === 'CANCELLED') return;
    state.transition('camera_error');
    const message = error?.publicMessage || (String(error?.message ?? '').includes('WebGL2')
      ? 'Este navegador necesita WebGL2 para mostrar la experiencia.'
      : 'No se pudo iniciar la cámara. Inténtalo de nuevo.');
    ui.showRetry(message, error?.code === 'DENIED' ? 'Reintentar' : 'Reintentar');
  }
}

async function restartFlow() {
  ++runToken;
  stopLoop();
  camera.stop();
  timeline.stop();
  videoView.close();
  resetPostInterface();
  try {
    const permission = await navigator.permissions?.query({ name: 'camera' });
    if (permission?.state === 'granted') return startExperience();
  } catch { /* Permission API is optional. */ }
  showPermission();
}

function renderLive(stage) {
  const size = renderer.resize();
  composition.updateFrame(video.videoWidth, video.videoHeight, size.width, size.height);
  renderer.render(video, composition.getCells(stage, stage.localTime));
}

function freezeCameraFrame() {
  if (!video.videoWidth || !video.videoHeight) return false;
  if (!composition.cells.length) {
    const first = sequence[0];
    renderLive({ ...first, localTime: 0, progress: 0 });
  }
  composition.getCells(sequence.at(-1), 0);
  const size = renderer.resize();
  frozenVideoSize = { width: video.videoWidth, height: video.videoHeight };
  composition.updateFrame(frozenVideoSize.width, frozenVideoSize.height, size.width, size.height);
  renderFinalFrame(renderer, composition.cells, FINAL_EXPOSURE);
  camera.stop();
  state.transition('camera_finalizing');
  return true;
}

function renderFinal() {
  if (!frozenVideoSize) return;
  const size = renderer.resize();
  composition.updateFrame(frozenVideoSize.width, frozenVideoSize.height, size.width, size.height);
  renderFinalFrame(renderer, composition.cells, FINAL_EXPOSURE);
}

function renderLoop(now) {
  if (!['camera_running', 'camera_finalizing'].includes(state.current)) return;
  if (!document.hidden) {
    const stage = getStageAt(timeline.getElapsed(now), sequence);
    if (stage.id === 6) {
      if (state.current === 'camera_running' && !freezeCameraFrame()) {
        animationFrame = requestAnimationFrame(renderLoop);
        return;
      }
      enterQuestion();
      return;
    }
    if (stage.id === 4) {
      if (state.current === 'camera_running') freezeCameraFrame();
      else renderFinal();
    } else if (state.current === 'camera_running') renderLive(stage);
  }
  animationFrame = requestAnimationFrame(renderLoop);
}

function updateGenerative() {
  if (postShell.hidden) return;
  renderGenerativeLayers($('#generativeLayers'), runSeed, window.innerWidth, window.innerHeight);
}

function preserveFinalBackground() {
  if (!savedBackground) savedBackground = canvas.toDataURL('image/png');
  $('#capturedBackground').style.backgroundImage = `url("${savedBackground}")`;
  sceneShell.classList.add('has-capture');
}

function enterQuestion() {
  stopLoop();
  timeline.stop();
  camera.stop();
  if (state.current === 'camera_running') state.transition('camera_finalizing');
  if (state.current !== 'question') state.transition('question');
  controls.hidden = true;
  ui.hide();
  preserveFinalBackground();
  disposeArchive();
  questionView.hidden = false;
  postShell.hidden = false;
  $('#archiveButton').removeAttribute('aria-current');
  postShell.classList.remove('is-archive');
  updateGenerative();
  questionDrag.reset();
  questionTitles.start();
}

function enterArchive() {
  if (state.current === 'archive' || state.current !== 'question' || state.aboutOpen) return;
  questionTitles.stop();
  state.transition('archive');
  questionView.hidden = true;
  archiveRoot.hidden = false;
  postShell.classList.add('is-archive');
  $('#archiveButton').setAttribute('aria-current', 'page');
  archive = new ArchiveView(archiveRoot, createRandom(`${runSeed}:archive`), repository.getAll());
  archive.mount().catch(error => console.error('No se pudo preparar el Archivo', error));
}

function openAbout() {
  if (!state.openAbout()) return;
  const opener = document.activeElement;
  archive?.pause();
  sceneShell.classList.add('is-obscured');
  sceneShell.inert = true;
  about.open(opener);
  const dialog = $('.about-dialog');
  renderOrnament($('#aboutOrnament'), `${runSeed}:ornament`, dialog.clientWidth, dialog.clientHeight);
}

function closeAbout() {
  if (!state.closeAbout()) return;
  sceneShell.inert = false;
  sceneShell.classList.remove('is-obscured');
  about.close();
  archive?.resume();
}

function openVideo() {
  if (!['question', 'archive'].includes(state.current)) return;
  questionTitles.stop();
  if (state.aboutOpen) closeAbout();
  disposeArchive();
  state.transition('video');
  postShell.hidden = true;
  videoView.open();
}

function leaveVideo() {
  if (state.current !== 'video') return;
  videoView.close();
  state.transition('question');
  enterQuestion();
}

function skipCamera() {
  if (state.current !== 'camera_running' && state.current !== 'camera_finalizing') return;
  if (state.current === 'camera_running' && !freezeCameraFrame()) return;
  enterQuestion();
}

function saveCapture() {
  if (!['camera_running', 'camera_finalizing'].includes(state.current)) return;
  canvas.toBlob(blob => {
    if (!blob) return;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `transfiguracion-capture-${stamp}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function handleCameraInterrupted() {
  if (state.current !== 'camera_running') return;
  ++runToken;
  stopLoop();
  timeline.stop();
  camera.stop();
  state.transition('camera_error');
  controls.hidden = true;
  ui.showRetry('La cámara dejó de estar disponible. Puedes intentarlo de nuevo.');
}

$('#cameraAction').addEventListener('click', startExperience);
$('#mainLogo').addEventListener('click', restartFlow);
$('#backButton').addEventListener('click', restartFlow);
$('#skipButton').addEventListener('click', skipCamera);
$('#saveButton').addEventListener('click', saveCapture);
$('#exitButton').addEventListener('click', enterArchive);
$('#aboutButton').addEventListener('click', openAbout);
$('#archiveButton').addEventListener('click', enterArchive);
$('#videoButton').addEventListener('click', openVideo);
$('#aboutVideo').addEventListener('click', openVideo);
$('#questionForm').addEventListener('submit', event => {
  event.preventDefault();
  if (state.current !== 'question') return;
  answer.value = answer.value.slice(0, RESPONSE_MAX_LENGTH);
  repository.add(answer.value, ++submissionNumber);
  enterArchive();
});
camera.onInterrupted = handleCameraInterrupted;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.current === 'camera_finalizing') renderFinal();
    else if (state.current === 'question' || state.current === 'archive') updateGenerative();
    if (state.current === 'archive' && archive && archive.mobile !== matchMedia('(max-width: 700px)').matches) {
      archive.dispose();
      archive = new ArchiveView(archiveRoot, createRandom(`${runSeed}:archive`), repository.getAll());
      archive.mount().catch(error => console.error('No se pudo adaptar el Archivo', error));
    }
    if (state.aboutOpen) {
      const dialog = $('.about-dialog');
      renderOrnament($('#aboutOrnament'), `${runSeed}:ornament`, dialog.clientWidth, dialog.clientHeight);
    }
  }, 100);
});
function shutdown() {
  questionTitles.stop();
  ++runToken;
  stopLoop();
  archive?.dispose();
  camera.stop();
  videoView.close();
  renderer?.dispose();
  renderer = null;
}
window.addEventListener('pagehide', shutdown);
window.addEventListener('pageshow', event => { if (event.persisted) restartFlow(); });
showPermission();
