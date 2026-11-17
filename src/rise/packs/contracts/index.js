/**
 * Contracts pack: coded diagnostics and deterministic hashing.
 * Infrastructure for assets, caches and CI that most games do not need at runtime, so it is opt-in.
 */
export {
  DIAGNOSTIC_CODE,
  ok,
  fail,
  isOk,
  unwrap,
  diagnostic,
  formatDiagnostic,
  mergeDiagnostics,
} from './diagnostics.js';
export { stableStringify, fnv1a, hashValue, shortHash, sha256Hex } from './hash.js';
