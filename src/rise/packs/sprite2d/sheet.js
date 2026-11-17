/**
 * Parse sprite sheet JSON (Aseprite array/hash, TexturePacker) → frames + clips.
 * Pure, no DOM.
 */
export function parseSheet(json, { textureWidth = 0, textureHeight = 0 } = {}) {
  if (!json || typeof json !== 'object') throw new Error('[sheet] invalid JSON');

  const texW = textureWidth || json.meta?.size?.w || 0;
  const texH = textureHeight || json.meta?.size?.h || 0;

  const rawFrames = json.frames;
  const frames = [];
  const order = [];

  const push = (name, frame, duration) => {
    const f = {
      name,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
      duration: Number(duration) || 100,
    };
    if (texW && texH) f.uv = uvFor(f, texW, texH);
    frames.push(f);
    order.push(name);
  };

  if (Array.isArray(rawFrames)) {
    for (const item of rawFrames) {
      push(item.filename || `frame_${frames.length}`, item.frame || item, item.duration);
    }
  } else if (rawFrames && typeof rawFrames === 'object') {
    for (const [name, item] of Object.entries(rawFrames)) {
      push(name, item.frame || item, item.duration);
    }
  }

  const clips = [];
  const tags = json.meta?.frameTags;
  if (Array.isArray(tags) && tags.length) {
    for (const tag of tags) {
      const names = order.slice(tag.from ?? 0, (tag.to ?? order.length - 1) + 1);
      if (!names.length) continue;
      const durations = names.map((n) => frames.find((f) => f.name === n)?.duration || 100);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      clips.push({ name: tag.name || `clip_${clips.length}`, frames: names, fps: Math.round((1000 / avg) * 100) / 100, loop: tag.direction !== 'pingpong' });
    }
  }

  for (const [name, list] of Object.entries(json.animations || {})) {
    clips.push({ name, frames: list.slice(), fps: 10, loop: true });
  }

  if (!clips.length && order.length) clips.push({ name: 'default', frames: order.slice(), fps: 10, loop: true });

  return { frames, clips, order, texture: { width: texW, height: texH } };
}

/** UV [u0,v0,u1,v1] with v flipped (three UVs start bottom-left, images start top-left). */
export function uvFor(frame, texW, texH) {
  const u0 = frame.x / texW;
  const u1 = (frame.x + frame.w) / texW;
  const v1 = 1 - frame.y / texH;
  const v0 = 1 - (frame.y + frame.h) / texH;
  return [u0, v0, u1, v1];
}

/** Turns a clip into a list of frames with durations for SpriteAnimator. */
export function clipTimeline(sheet, name) {
  const clip = sheet.clips.find((c) => c.name === name) || sheet.clips[0];
  if (!clip) return null;
  const step = 1 / Math.max(0.001, clip.fps);
  return clip.frames.map((frame, i) => ({ frame, t: i * step, duration: step }));
}
