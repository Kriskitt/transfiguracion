import "./styles.css";
import mainLogoMarkup from "../rsc_/trans_logo.svg?raw";
import { CameraController } from "./camera.js";
import { CONFIRMATION_MS, FINAL_EXPOSURE, QUESTION_TEXT, RESPONSE_MAX_LENGTH } from "./config.js";
import { CompositionController } from "./composition.js";
import { createFramePaths } from "./effects/frame-paths.js";
import { createAnimatedLogo } from "./effects/logo.js";
import { createExperimentalParagraph } from "./effects/typography.js";
import { createRandom, createRunSeed, createSeedFromQuery } from "./random.js";
import { WebGLRenderer } from "./renderer.js";
import { ResponseController } from "./response.js";
import { AppState } from "./state.js";
import { getStageAt, Timeline } from "./timeline.js";
import { InterfaceController } from "./ui.js";
import { AboutView } from "./views/about.js";
import { ArchiveView } from "./views/archive.js";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#output");
const video = $("#camera");
const sceneShell = $("#sceneShell");
const postShell = $("#postShell");
const questionView = $("#questionView");
const archiveRoot = $("#archiveView");
const answer = $("#answer");
const confirmation = $("#confirmation");
const sendButton = $("#sendButton");
const aboutButton = $("#aboutButton");
const archiveButton = $("#archiveButton");
const ui = new InterfaceController($("#cameraPanel"), $("#cameraMessage"), $("#cameraAction"));
const state = new AppState();
const camera = new CameraController(video);
const timeline = new Timeline();
const response = new ResponseController(CONFIRMATION_MS);
const querySeed = createSeedFromQuery();

let renderer = null;
let composition = null;
let archive = null;
let mainLogo = null;
let animationFrame = 0;
let runToken = 0;
let runSeed = "";
let frozenVideoSize = null;
let lastPostDraw = 0;
let archiveAfterAbout = false;

const about = new AboutView($("#aboutLayer"), createRandom(`${querySeed ?? "about"}:about`), closeAbout);

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
  response.cancel();
  sendButton.disabled = false;
  confirmation.textContent = "";
  answer.value = "";
  if (state.aboutOpen) closeAbout();
  disposeArchive();
  mainLogo?.dispose();
  mainLogo = null;
  postShell.hidden = true;
  questionView.hidden = false;
  archiveButton.removeAttribute("aria-current");
  $("#edgeFrame").replaceChildren();
}

async function startExperience() {
  const token = ++runToken;
  archiveAfterAbout = false;
  stopLoop();
  resetPostInterface();
  camera.stop();
  timeline.stop();
  composition = null;
  frozenVideoSize = null;
  lastPostDraw = 0;
  if (state.current !== "camera_idle") state.transition("camera_idle");
  state.transition("camera_permission");
  ui.showPending();

  try {
    if (!renderer) renderer = new WebGLRenderer(canvas);
    await camera.start();
    if (token !== runToken) return;
    runSeed = createRunSeed(querySeed);
    composition = new CompositionController(createRandom(`${runSeed}:camera`));
    timeline.start(performance.now());
    state.transition("camera_running");
    ui.hide();
    animationFrame = requestAnimationFrame(renderLoop);
  } catch (error) {
    if (token !== runToken || error?.code === "CANCELLED") return;
    state.transition("camera_error");
    const message = error?.publicMessage || (String(error?.message ?? "").includes("WebGL2")
      ? "Este navegador necesita WebGL2 para mostrar la experiencia."
      : "No se pudo iniciar la cámara. Inténtalo de nuevo.");
    ui.showRetry(message, error?.code === "DENIED" ? "Permitir cámara" : "Reintentar");
  }
}

function renderLive(stage) {
  const size = renderer.resize();
  composition.updateFrame(video.videoWidth, video.videoHeight, size.width, size.height);
  renderer.render(video, composition.getCells(stage, stage.localTime));
}

function freezeCameraFrame() {
  const size = renderer.resize();
  frozenVideoSize = { width: video.videoWidth, height: video.videoHeight };
  composition.updateFrame(frozenVideoSize.width, frozenVideoSize.height, size.width, size.height);
  const cells = composition.getCells({ id: 3, localTime: 7000 }, 7000);
  renderer.render(video, cells);
  camera.stop();
  state.transition("camera_finalizing");
}

function renderFrozen(stage, now) {
  const size = renderer.resize();
  composition.updateFrame(frozenVideoSize.width, frozenVideoSize.height, size.width, size.height);
  const cells = composition.getCells(stage, stage.localTime);
  const invert = stage.id === 4 ? stage.progress : 1;
  const exposure = stage.id === 5
    ? FINAL_EXPOSURE * (1 - (1 - stage.progress) ** 2)
    : stage.id >= 6 ? FINAL_EXPOSURE : 0;
  renderer.render(null, cells, {
    invert,
    exposure,
    driftTime: stage.id >= 6 ? now : undefined,
  });
}

function renderLoop(now) {
  if (!["camera_running", "camera_finalizing"].includes(state.current)) return;
  if (document.hidden) {
    animationFrame = requestAnimationFrame(renderLoop);
    return;
  }
  const stage = getStageAt(timeline.getElapsed(now));
  if (state.current === "camera_running" && stage.id < 4) {
    renderLive(stage);
  } else {
    if (state.current === "camera_running") freezeCameraFrame();
    if (stage.id === 6) {
      renderFrozen(stage, now);
      enterQuestion();
      return;
    }
    renderFrozen(stage, now);
  }
  animationFrame = requestAnimationFrame(renderLoop);
}

function postLoop(now) {
  if (!["question", "archive"].includes(state.current)) return;
  if (!document.hidden && !state.aboutOpen && now - lastPostDraw >= 80) {
    renderFrozen({ id: 6, localTime: 0, progress: 1 }, now);
    lastPostDraw = now;
  }
  animationFrame = requestAnimationFrame(postLoop);
}

function mountPostChrome() {
  postShell.hidden = false;
  if (!mainLogo) mainLogo = createAnimatedLogo($("#mainLogo"), mainLogoMarkup, "main", createRandom(`${runSeed}:logo`));
  createFramePaths($("#edgeFrame"), createRandom(`${runSeed}:${state.current}:frame:${performance.now()}`));
}

function enterQuestion() {
  stopLoop();
  timeline.stop();
  camera.stop();
  state.transition("question");
  ui.hide();
  questionView.hidden = false;
  archiveRoot.hidden = true;
  postShell.hidden = false;
  archiveButton.removeAttribute("aria-current");
  $("#questionHeading").replaceChildren(createExperimentalParagraph(
    QUESTION_TEXT, Math.min(window.innerWidth * 0.54, 1020), 34, createRandom(`${runSeed}:question`),
  ));
  mountPostChrome();
  lastPostDraw = 0;
  animationFrame = requestAnimationFrame(postLoop);
}

function enterArchive() {
  if (state.current === "archive") return;
  if (state.current !== "question") return;
  if (state.aboutOpen) {
    archiveAfterAbout = true;
    return;
  }
  response.cancel();
  confirmation.textContent = "";
  sendButton.disabled = false;
  state.transition("archive");
  questionView.hidden = true;
  archiveRoot.hidden = false;
  archiveButton.setAttribute("aria-current", "page");
  createFramePaths($("#edgeFrame"), createRandom(`${runSeed}:archive:frame:${performance.now()}`));
  archive = new ArchiveView(archiveRoot, createRandom(`${runSeed}:archive`));
  archive.mount().catch((error) => console.error("No se pudo preparar el Archivo", error));
}

function openAbout() {
  if (!state.openAbout()) return;
  sceneShell.classList.add("is-obscured");
  archive?.pause();
  about.open(document.activeElement);
}

function closeAbout() {
  if (!state.closeAbout()) return;
  about.close();
  sceneShell.classList.remove("is-obscured");
  archive?.resume();
  if (archiveAfterAbout) {
    archiveAfterAbout = false;
    enterArchive();
  }
}

function handleCameraInterrupted() {
  if (state.current !== "camera_running") return;
  ++runToken;
  stopLoop();
  timeline.stop();
  camera.stop();
  state.transition("camera_error");
  ui.showRetry("La cámara dejó de estar disponible. Puedes intentarlo de nuevo.");
}

$("#cameraAction").addEventListener("click", startExperience);
$("#mainLogo").addEventListener("click", startExperience);
$("#backButton").addEventListener("click", startExperience);
$("#exitButton").addEventListener("click", enterArchive);
aboutButton.addEventListener("click", openAbout);
archiveButton.addEventListener("click", enterArchive);
$("#questionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.current !== "question") return;
  answer.value = answer.value.slice(0, RESPONSE_MAX_LENGTH);
  if (response.submit(answer.value, enterArchive)) {
    sendButton.disabled = true;
    confirmation.textContent = "Mensaje enviado (simulación)";
  }
});
camera.onInterrupted = handleCameraInterrupted;

function shutdown() {
  ++runToken;
  stopLoop();
  response.cancel();
  archive?.dispose();
  camera.stop();
  renderer?.dispose();
  renderer = null;
}
window.addEventListener("pagehide", shutdown);
window.addEventListener("beforeunload", shutdown);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) startExperience();
});

startExperience();
