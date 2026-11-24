import videoUrl from '../../rsc_/video/Transfiguración_video.webm?url';
import { playbackDuration, playbackProgress } from './video-time.js';

export class VideoView {
  constructor(root, onClose) {
    this.root = root;
    this.video = root.querySelector('#artVideo');
    this.video.src = videoUrl;
    this.playButton = root.querySelector('#videoPlay');
    this.timeline = root.querySelector('#videoTimeline');
    this.progress = root.querySelector('#videoProgress');
    this.volumeScale = root.querySelector('#videoVolumeScale');
    this.volumeFill = root.querySelector('#videoVolumeFill');
    this.volumeThumb = root.querySelector('#videoVolumeThumb');
    this.volumeValue = root.querySelector('#videoVolumeValue');
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
    this.video.addEventListener('volumechange', () => this.updateVolume());
    this.volumeScale.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      this.volumeScale.setPointerCapture(event.pointerId);
      this.setVolumeFromPointer(event);
      event.preventDefault();
    });
    this.volumeScale.addEventListener('pointermove', event => {
      if (this.volumeScale.hasPointerCapture(event.pointerId)) this.setVolumeFromPointer(event);
    });
    this.volumeScale.addEventListener('pointerup', event => {
      if (this.volumeScale.hasPointerCapture(event.pointerId)) this.volumeScale.releasePointerCapture(event.pointerId);
    });
    this.volumeScale.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = this.video.muted ? 0 : this.video.volume * 8;
      this.setVolume(event.key === 'Home' ? 0 : event.key === 'End' ? 8
        : current + (['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1));
    });
    this.updateVolume();
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
  setVolumeFromPointer(event) {
    const rect = this.volumeScale.getBoundingClientRect();
    this.setVolume(Math.round(Math.min(1, Math.max(0, (rect.bottom - event.clientY) / rect.height)) * 80) / 10);
  }
  setVolume(value) {
    const level = Math.min(8, Math.max(0, value));
    this.video.volume = level / 8;
    this.video.muted = level === 0;
    this.updateVolume();
  }
  updateVolume() {
    const level = this.video.muted ? 0 : this.video.volume * 8;
    const display = Math.round(level * 10) / 10;
    const label = String(display);
    const percent = `${level / 8 * 100}%`;
    this.volumeFill.style.height = percent;
    this.volumeThumb.style.bottom = percent;
    this.volumeValue.style.bottom = percent;
    this.volumeValue.textContent = label;
    this.volumeScale.setAttribute('aria-valuenow', label);
    this.volumeScale.setAttribute('aria-valuetext', `${label} de 8`);
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
