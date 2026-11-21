import videoUrl from '../../rsc_/video/Transfiguración_video.webm?url';
import { playbackDuration, playbackProgress } from './video-time.js';

export class VideoView {
  constructor(root, onClose) {
    this.root = root;
    this.video = root.querySelector('#artVideo');
    this.video.src = videoUrl;
    this.playButton = root.querySelector('#videoPlay');
    this.timeline = root.querySelector('#videoTimeline');
    this.progress = root.querySelector('#videoProgress');
    this.onMediaChange = () => this.update();
    this.onPlay = () => { this.update(); this.startProgressLoop(); };
    this.onPause = () => { this.stopProgressLoop(); this.update(); };
    this.mediaEvents = ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'durationchange'];
    root.querySelector('#videoClose').addEventListener('click', onClose);
    this.playButton.addEventListener('click', () => this.toggle());
    this.video.addEventListener('click', () => this.toggle());
    this.timeline.addEventListener('pointerdown', event => {
      const rect = this.timeline.getBoundingClientRect();
      this.seek((event.clientX - rect.left) / rect.width);
    });
    this.timeline.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const value = playbackProgress(this.video.currentTime, this.video.duration);
      this.seek(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : value + (event.key === 'ArrowRight' ? .025 : -.025));
    });
  }
  async open() {
    this.root.hidden = false;
    for (const type of this.mediaEvents) this.video.addEventListener(type, this.onMediaChange);
    this.video.addEventListener('play', this.onPlay);
    this.video.addEventListener('pause', this.onPause);
    this.video.addEventListener('ended', this.onPause);
    if (this.video.ended) this.video.currentTime = 0;
    try { await this.video.play(); } catch { this.playButton.hidden = false; }
    this.update();
  }
  close() {
    this.video.pause();
    this.stopProgressLoop();
    for (const type of this.mediaEvents) this.video.removeEventListener(type, this.onMediaChange);
    this.video.removeEventListener('play', this.onPlay);
    this.video.removeEventListener('pause', this.onPause);
    this.video.removeEventListener('ended', this.onPause);
    this.root.hidden = true;
  }
  async toggle() {
    if (this.video.paused) {
      try { await this.video.play(); } catch { this.playButton.hidden = false; }
    } else this.video.pause();
    this.update();
  }
  seek(fraction) {
    this.video.currentTime = Math.min(1, Math.max(0, fraction)) * playbackDuration(this.video.duration);
    this.update();
  }
  update() {
    const fraction = this.video.ended ? 1 : playbackProgress(this.video.currentTime, this.video.duration);
    this.progress.style.width = `${fraction * 100}%`;
    this.timeline.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    this.playButton.hidden = !this.video.paused;
    this.playButton.textContent = this.video.ended ? 'Reproducir de nuevo' : 'Reproducir';
  }
  startProgressLoop() {
    this.stopProgressLoop();
    const tick = () => {
      this.update();
      if (!this.video.paused && !this.root.hidden) this.progressFrame = requestAnimationFrame(tick);
    };
    this.progressFrame = requestAnimationFrame(tick);
  }
  stopProgressLoop() {
    if (this.progressFrame !== undefined) cancelAnimationFrame(this.progressFrame);
    this.progressFrame = undefined;
  }
}
