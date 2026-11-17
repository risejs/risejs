// Wrapper: runs the API surface check (the logic lives in gen-api-surface.mjs --check).
process.argv.push('--check');
await import('./gen-api-surface.mjs');
