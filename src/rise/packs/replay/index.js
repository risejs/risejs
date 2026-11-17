import { Recorder, Playback } from './core.js';
export { Recorder, Playback };

/**
 * Replay pack: records input per tick, plays it back, exports/imports JSON.
 *
 *   app.use(replayPlugin);
 *   app.replay.start();          // record
 *   app.replay.stop();           // stop, logs the JSON
 *   app.replay.load(json);       // play back
 */
export function replayPlugin(app, { tickMs = 50 } = {}) {
  let recorder = null;
  let playback = null;
  let clock = 0;

  function start() {
    recorder = new Recorder({ tickMs, seed: app.rng?.seed ?? 1 });
    playback = null;
    clock = 0;
    app.replayRecording = true;
    app.events.emit('replay:start');
    return recorder;
  }

  function stop() {
    app.replayRecording = false;
    const data = recorder?.toJSON({ game: app.game?.id || app.id });
    app.events.emit('replay:stop', data);
    return data;
  }

  function load(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    playback = new Playback(data);
    recorder = null;
    clock = 0;
    app.replayPlaying = true;
    app.events.emit('replay:play', data);
    return playback;
  }

  function cancel() {
    playback = null;
    app.replayPlaying = false;
  }

  const off = app.events.on('frame', (dt) => {
    if (app.replayPlaying && playback) {
      clock += dt * 1000;
      const input = playback.at(clock);
      if (app.input) app.input.auto = input;
      if (app.player) app.player.yaw = input.yaw;
      if (playback.done) {
        app.replayPlaying = false;
        if (app.input) app.input.auto = null;
        app.events.emit('replay:end');
      }
      return;
    }

    if (app.replayRecording && recorder) {
      clock += dt;
      const mx = (app.input?.down('right') ? 1 : 0) - (app.input?.down('left') ? 1 : 0);
      const mz = (app.input?.down('forward') ? 1 : 0) - (app.input?.down('back') ? 1 : 0);
      recorder.record(clock, { mx, mz, yaw: app.player?.yaw ?? 0 });
    }
  });

  const api = {
    start,
    stop,
    load,
    cancel,
    get recording() {
      return app.replayRecording;
    },
    get playing() {
      return app.replayPlaying;
    },
    get frames() {
      return recorder?.frames.length ?? 0;
    },
    export: () => recorder?.toJSON({ game: app.game?.id || app.id }) ?? null,
    dispose() {
      off();
      if (app.replayPlaying && app.input) app.input.auto = null;
      delete app.replayRecording;
      delete app.replayPlaying;
      recorder = playback = null;
      if (app.replay === api) app.replay = null;
    },
  };

  app.replay = api;
  return api;
}
