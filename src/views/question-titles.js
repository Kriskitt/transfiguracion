import { QUESTION_TITLES } from '../config.js';

export class QuestionTitles {
  constructor(element, random = Math.random) {
    this.element = element;
    this.random = random;
    this.timer = 0;
    this.order = [];
    this.index = 0;
    this.last = null;
  }

  shuffle() {
    const order = [...QUESTION_TITLES];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order[0] === this.last) [order[0], order[1]] = [order[1], order[0]];
    this.order = order;
    this.index = 0;
  }

  next() {
    if (this.index === this.order.length) this.shuffle();
    this.last = this.order[this.index++];
    this.element.textContent = this.last;
    this.timer = window.setTimeout(() => this.next(), 1000 + this.random() * 2000);
  }

  start() {
    this.stop();
    this.order = [];
    this.index = 0;
    this.last = null;
    this.next();
  }

  stop() {
    window.clearTimeout(this.timer);
    this.timer = 0;
  }
}
