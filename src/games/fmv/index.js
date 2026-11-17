import { fmvPlugin } from '../../rise/packs/fmv/index.js';
import { VideoLayer } from '../../rise/packs/fmv/video.js';

const SCENES = {
  intro: {
    title: 'DOCK 04',
    text: 'You wake up on a concrete floor. Emergency lights flicker and the dock is deserted.',
    duration: 6,
    bg: 'linear-gradient(160deg,#1b232b,#0a0d10 60%,#16100c)',
    subs: [
      { t: 1, text: '[radio] Warden, do you copy?' },
      { t: 3.5, text: '[radio] They have sealed the dock. You need to leave now.' },
    ],
    choices: [
      { at: 4, label: 'Go to the pier', next: 'dock' },
      { at: 4, label: 'Go back to the warehouse', next: 'back' },
    ],
  },
  dock: {
    title: 'THE PIER',
    text: 'Rain lashes your face. A figure stands at the end of the pier.',
    duration: 8,
    bg: 'linear-gradient(180deg,#0d1620,#0a0d10 55%,#241a12)',
    subs: [
      { t: 1, text: '[radio] Do not let it see you.' },
      { t: 4, text: 'Footsteps behind you...' },
    ],
    qte: { at: 2, window: 1.2, key: 'KeyE', next: 'escape', fail: 'caught' },
  },
  escape: {
    title: 'ESCAPE',
    text: 'You sprint across the pier and jump into the boat. The engine starts.',
    duration: 5,
    bg: 'linear-gradient(160deg,#0e2a24,#0a0d10)',
    next: 'end',
  },
  caught: {
    title: 'CAUGHT',
    text: 'A hand grabs your shoulder. The screen fades to black.',
    duration: 5,
    bg: 'linear-gradient(160deg,#2a0e0e,#0a0d10)',
    next: 'end',
  },
  back: {
    title: 'THE WAREHOUSE',
    text: 'The warehouse door is locked from the inside. You go back to the pier.',
    duration: 4,
    bg: 'linear-gradient(160deg,#1a1a22,#0a0d10)',
    next: 'dock',
  },
  end: {
    title: 'THE END',
    text: 'Prototype FMV · timeline + choice + QTE.',
    duration: 3,
    bg: 'linear-gradient(160deg,#101418,#05070a)',
    next: null,
  },
};

export default {
  id: 'fmv',
  title: 'Rise — FMV',

  config: {
    preset: { camera: 'fp', crosshair: 'none' },
    render: { fog: 0.02, exposure: 1 },
    player: { controller: 'none', spawn: [0, 2, 0] },
    hud: { hint: { enabled: false }, objective: { enabled: false }, badge: { enabled: false } },
  },

  build(app) {
    // Real clip: ?game=fmv&video=/fmv/intro.mp4&sub=/fmv/intro.vtt
    const src = app.options.video;
    if (src) {
      const video = new VideoLayer(app, {
        src,
        subtitle: app.options.sub,
        muted: app.options.mute === '1',
      });
      video.on('end', () => app.hud.setHint('CLIP ENDED · P opens the menu'));
      app.video = video;
      app.hud.setHint('CLICK TO PLAY THE CLIP');
      const kick = () => {
        video.play();
        window.removeEventListener('pointerdown', kick);
      };
      window.addEventListener('pointerdown', kick, { once: true });
    }

    app.use(fmvPlugin, {
      scenes: SCENES,
      start: 'intro',
      onEnd: () => {
        app.hud.setHint('THE END · P opens the menu');
      },
    });
  },
};
