/**
 * Picks the video playback path. Pure, no DOM, testable in Node.
 *
 *   pickPlayback('a.m3u8', (t) => t.includes('mpegurl'), { mp4: 'a.mp4' })
 *   → { mode: 'native-hls', src: 'a.m3u8', note: null }
 */
export function isHls(src = '') {
  return /\.m3u8(\?|#|$)/i.test(String(src));
}

export function canPlayNativeHls(canPlayType = () => '') {
  try {
    return !!canPlayType('application/vnd.apple.mpegurl');
  } catch {
    return false;
  }
}

export function pickPlayback(src, canPlayType, { mp4 = null } = {}) {
  if (!src) return { mode: 'none', src: '', note: 'no source' };

  if (!isHls(src)) return { mode: 'progressive', src, note: null };

  if (canPlayNativeHls(canPlayType)) {
    return { mode: 'native-hls', src, note: 'HLS native (Safari/iOS)' };
  }

  if (mp4) {
    return { mode: 'fallback-mp4', src: mp4, note: 'HLS is not supported, using MP4' };
  }

  return { mode: 'unsupported', src, note: 'HLS is not supported and there is no MP4 fallback' };
}
