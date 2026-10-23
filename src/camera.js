import { CAMERA_CONSTRAINTS } from "./config.js";

export class CameraController {
  constructor(video, mediaDevices = globalThis.navigator?.mediaDevices) {
    this.video = video;
    this.mediaDevices = mediaDevices;
    this.stream = null;
    this.onInterrupted = null;
    this.generation = 0;
    this.cancelFrameWait = null;
  }

  async start() {
    this.stop();
    const generation = this.generation;

    if (!this.mediaDevices?.getUserMedia) {
      throw this.createPublicError(
        "UNSUPPORTED",
        "Este navegador no permite acceder a la cámara desde esta página.",
      );
    }

    try {
      const stream = await this.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        throw this.createPublicError("CANCELLED", "");
      }
      this.stream = stream;
      this.video.srcObject = this.stream;
      this.bindTrackEnd();
      await this.video.play();
      if (generation !== this.generation) {
        throw this.createPublicError("CANCELLED", "");
      }
      await this.waitForUsableFrame();
      if (generation !== this.generation) {
        throw this.createPublicError("CANCELLED", "");
      }
      return this.stream;
    } catch (error) {
      this.stop();
      throw this.toPublicError(error);
    }
  }

  stop() {
    this.generation += 1;
    this.cancelFrameWait?.();
    this.cancelFrameWait = null;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      this.stream = null;
    }
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.srcObject = null;
    this.video.load();
  }

  bindTrackEnd() {
    this.stream?.getVideoTracks().forEach((track) => {
      track.onended = () => {
        this.onInterrupted?.();
      };
    });
  }

  waitForUsableFrame() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let callbackId = null;
      const finishWait = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.video.removeEventListener?.("loadeddata", finish);
        this.video.removeEventListener?.("canplay", finish);
        if (callbackId !== null) this.video.cancelVideoFrameCallback?.(callbackId);
        this.cancelFrameWait = null;
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(() => {
        finishWait(this.createPublicError("NO_FRAME", "La cámara se abrió, pero no entregó una imagen utilizable."));
      }, 8000);

      const finish = () => {
        if (settled) return;
        if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
          finishWait();
        }
      };

      this.cancelFrameWait = () => finishWait(this.createPublicError("CANCELLED", ""));

      if ("requestVideoFrameCallback" in this.video) {
        callbackId = this.video.requestVideoFrameCallback(finish);
      } else {
        this.video.addEventListener("loadeddata", finish);
        this.video.addEventListener("canplay", finish);
        finish();
      }
    });
  }

  toPublicError(error) {
    if (error?.code === "CANCELLED" || error?.publicMessage) return error;

    const name = error?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return this.createPublicError(
        "DENIED",
        "No se pudo usar la cámara. Revisa el permiso del navegador e inténtalo de nuevo.",
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return this.createPublicError(
        "NO_DEVICE",
        "No se encontró una cámara disponible en este equipo.",
      );
    }
    if (name === "NotReadableError" || name === "AbortError") {
      return this.createPublicError(
        "BUSY",
        "La cámara no está disponible ahora. Puede estar en uso por otra aplicación.",
      );
    }

    return this.createPublicError(
      "UNKNOWN",
      "No se pudo iniciar la cámara. Inténtalo de nuevo.",
    );
  }

  createPublicError(code, publicMessage) {
    const error = new Error(code);
    error.code = code;
    error.publicMessage = publicMessage;
    return error;
  }
}
