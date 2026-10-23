export class ResponseController {
  constructor(confirmationMs) {
    this.confirmationMs = confirmationMs;
    this.pending = false;
    this.timeout = null;
  }

  submit(_value, onComplete) {
    if (this.pending) return false;
    this.pending = true;
    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.pending = false;
      onComplete();
    }, this.confirmationMs);
    return true;
  }

  cancel() {
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
    this.pending = false;
  }
}
