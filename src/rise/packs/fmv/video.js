import * as THREE from 'three';
import { pickPlayback } from './playback.js';
export { pickPlayback };

/**
 * VideoLayer plays real FMV clips through a <video> element, with VTT subtitles.
 *
 * HLS: Safari and iOS play .m3u8 natively. Other browsers need the `mp4` fallback,
 * because Rise has no runtime dependencies and does not bundle an HLS library.
 *
 *   const layer = new VideoLayer(app, { src: '/fmv/intro.m3u8', mp4: '/fmv/intro.mp4', subtitle: '...' });
 *   await layer.play();
 *   layer.on('end', () => nextScene());
 *
 * `subtitleLang` sets the language code of the subtitle track (BCP 47, default 'en').
 */
export class VideoLayer {
  constructor(app, { src, mp4 = null, subtitle = null, subtitleLang = 'en', loop = false, muted = false, preload = 'auto', fit = 'cover' } = {}) {
    this.app = app;
    this.handlers = new Map();

    const probe = document.createElement('video');
    const plan = pickPlayback(src, (t) => probe.canPlayType(t), { mp4 });
    this.plan = plan;
    this.unsupported = plan.mode === 'unsupported' || plan.mode === 'none';

    const el = document.createElement('div');
    el.className = 'fmv-video';
    el.style.cssText = `position:absolute;inset:0;z-index:8;background:#000;opacity:0;transition:opacity .35s;pointer-events:none`;

    const video = document.createElement('video');
    video.src = plan.src;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = preload;
    video.loop = loop;
    video.muted = muted;
    video.style.cssText = `width:100%;height:100%;object-fit:${fit};display:block`;

    if (subtitle) {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = String(subtitleLang).toUpperCase();
      track.srclang = subtitleLang;
      track.src = subtitle;
      track.default = true;
      video.appendChild(track);
    }

    el.appendChild(video);
    (app.hud?.root || document.body).appendChild(el);

    this.el = el;
    this.video = video;

    if (plan.mode !== 'progressive') el.dataset.mode = plan.mode;
    if (plan.note && plan.mode === 'unsupported') console.warn('[fmv]', plan.note, src);

    video.addEventListener('ended', () => {
      if (!loop) this.hide();
      this.emit('end');
    });
    video.addEventListener('error', () => this.emit('error', video.error));
    video.addEventListener('timeupdate', () => this.emit('time', video.currentTime));
    // app.destroy() cleans up any layer still alive
    this._off = app.events?.on?.('app:destroy', () => this.destroy());
  }

  on(type, fn) {
    this.handlers.set(type, fn);
    return this;
  }

  emit(type, payload) {
    this.handlers.get(type)?.(payload);
  }

  async play() {
    if (this.unsupported) {
      this.emit('unsupported', this.plan);
      return false;
    }
    try {
      await this.video.play();
      this.el.style.opacity = '1';
      this.emit('play', this.plan);
      return true;
    } catch (err) {
      // autoplay was blocked, so a user gesture is needed
      this.emit('blocked', err);
      return false;
    }
  }

  pause() {
    this.video.pause();
  }

  hide() {
    this.el.style.opacity = '0';
    this.emit('hidden');
  }

  seek(t) {
    this.video.currentTime = t;
  }

  /** Preloads the next clip so the scene change does not flash black. */
  static preload(src) {
    const v = document.createElement('video');
    v.src = src;
    v.preload = 'auto';
    v.muted = true;
    VideoLayer._cache = VideoLayer._cache || new Map();
    VideoLayer._cache.set(src, v);
    return v;
  }

  dispose() {
    this.destroy();
  }

  destroy() {
    this._off?.();
    this._off = null;
    this.handlers.clear();
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.el.remove();
  }
}

/** Placeholder background for when there is no video yet (for prototypes). */
export function placeholderStage(app, { color = 0x0b0d0f } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(color);
  return scene;
}
