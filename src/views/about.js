import aboutLogoMarkup from "../../rsc_/trans_about_logo.svg?raw";
import { aboutParagraphs } from "../data/about.js";

export class AboutView {
  constructor(root, random, onRequestClose) {
    this.root = root;
    this.closeButton = root.querySelector("#aboutClose");
    this.logoContainer = root.querySelector("#aboutLogo");
    this.copy = root.querySelector("#aboutCopy");
    this.copy.replaceChildren(...aboutParagraphs.map((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      return paragraph;
    }));
    this.logoContainer.innerHTML = aboutLogoMarkup;
    this.focusReturn = null;
    this.onRequestClose = onRequestClose;
    this.onKeyDown = (event) => {
      if (event.key === "Escape" && !this.root.hidden) {
        event.preventDefault();
        this.onRequestClose();
      }
      if (event.key === "Tab" && !this.root.hidden) {
        const link = this.root.querySelector('#aboutVideo');
        if (event.shiftKey && document.activeElement === this.closeButton) {
          event.preventDefault(); link.focus();
        } else if (!event.shiftKey && document.activeElement === link) {
          event.preventDefault(); this.closeButton.focus();
        }
      }
    };
    this.closeButton.addEventListener("click", this.onRequestClose);
    window.addEventListener("keydown", this.onKeyDown);
  }

  open(opener) {
    this.focusReturn = opener;
    this.root.hidden = false;
    this.closeButton.focus();
  }

  close() {
    this.root.hidden = true;
    this.focusReturn?.focus();
    this.focusReturn = null;
  }

  dispose() {
    this.closeButton.removeEventListener("click", this.onRequestClose);
    window.removeEventListener("keydown", this.onKeyDown);
  }
}
