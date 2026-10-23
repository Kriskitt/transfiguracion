export class InterfaceController {
  constructor(panel, message, button) {
    this.panel = panel;
    this.message = message;
    this.button = button;
  }

  showPending() {
    this.panel.hidden = false;
    this.message.textContent = "Solicitando acceso a la cámara.";
    this.button.hidden = true;
  }

  showRetry(text, label = "Reintentar") {
    this.panel.hidden = false;
    this.message.textContent = text;
    this.button.textContent = label;
    this.button.hidden = false;
  }

  hide() {
    this.panel.hidden = true;
    this.button.hidden = true;
    this.message.textContent = "";
  }
}
