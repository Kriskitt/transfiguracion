const NEXT = {
  camera_idle: new Set(["camera_permission"]),
  camera_permission: new Set(["camera_running", "camera_error", "camera_idle"]),
  camera_running: new Set(["camera_finalizing", "camera_error", "camera_idle"]),
  camera_finalizing: new Set(["question", "camera_idle"]),
  camera_error: new Set(["camera_permission", "camera_idle"]),
  question: new Set(["archive", "camera_idle"]),
  archive: new Set(["camera_idle"]),
};

export class AppState {
  constructor() {
    this.current = "camera_idle";
    this.aboutOpen = false;
  }

  transition(next) {
    if (!NEXT[this.current]?.has(next)) return false;
    this.current = next;
    this.aboutOpen = false;
    return true;
  }

  openAbout() {
    if (this.aboutOpen || !["question", "archive"].includes(this.current)) return false;
    this.aboutOpen = true;
    return true;
  }

  closeAbout() {
    if (!this.aboutOpen) return false;
    this.aboutOpen = false;
    return true;
  }
}
