import aboutLogoMarkup from "../../rsc_/trans_about_logo.svg?raw";
import { aboutParagraphs } from "../data/about.js";
import { createAnimatedLogo } from "../effects/logo.js";

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
    this.logo = createAnimatedLogo(this.logoContainer, aboutLogoMarkup, "about", random);
    this.focusReturn = null;
    this.onRequestClose = onRequestClose;
    this.onKeyDown = (event) => {
      if (event.key === "Escape" && !this.root.hidden) {
        event.preventDefault();
        this.onRequestClose();
      }
      if (event.key === "Tab" && !this.root.hidden) {
        event.preventDefault();
        this.closeButton.focus();
      }
    };
    this.closeButton.addEventListener("click", this.onRequestClose);
    window.addEventListener("keydown", this.onKeyDown);
  }

  open(opener) {
    this.focusReturn = opener;
    this.root.hidden = false;
    this.logo.play();
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
    this.logo.dispose();
  }
}
