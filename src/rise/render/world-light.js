import * as THREE from 'three';

export const PALETTE = {
  zenith: new THREE.Color('#0a1018'),
  horizon: new THREE.Color('#33414d'),
  ground: new THREE.Color('#0b0e12'),
  fog: new THREE.Color('#141a20'),
  glow: new THREE.Color('#c8d8e8'),
};

/** Gradient sky drawn by a shader; colours come from config.sky. */
export function createSky(sky = {}) {
  const geo = new THREE.SphereGeometry(600, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(sky.zenith || PALETTE.zenith) },
      horizon: { value: new THREE.Color(sky.horizon || PALETTE.horizon) },
      ground: { value: new THREE.Color(sky.ground || PALETTE.ground) },
      glow: { value: new THREE.Color(sky.glow || PALETTE.glow) },
      glowStrength: { value: sky.glowStrength ?? 0.25 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 ground;
      uniform vec3 glow;
      uniform float glowStrength;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.55, h));
        col = mix(ground, col, smoothstep(-0.25, 0.02, h));
        float halo = pow(max(dot(normalize(vDir), normalize(vec3(-0.5, 0.14, 0.76))), 0.0), 6.0);
        col += glow * halo * glowStrength;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

/** Sun + fill + ambient + bounce light, parameters from config.lights (neutral colours). */
export function createLights(cfg = {}) {
  const sunCfg = cfg.sun || {};

  const sun = new THREE.DirectionalLight(new THREE.Color(sunCfg.color || '#fff4e6'), sunCfg.intensity ?? 3.4);
  sun.position.fromArray(sunCfg.position || [-26, 22, 40]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  const d = 70;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0009;

  const fill = new THREE.HemisphereLight(cfg.fillSky ?? 0x8fa6bd, cfg.fillGround ?? 0x2b2f33, cfg.fill ?? 1.6);
  const amb = new THREE.AmbientLight(cfg.ambientColor ?? 0x9fb2c4, cfg.ambient ?? 0.9);
  const rim = new THREE.DirectionalLight(cfg.rimColor ?? 0x9ab6d4, cfg.rimIntensity ?? 0.85);
  rim.position.set(24, 16, -44);

  const bounceCfg = cfg.bounce || {};
  const bounce = new THREE.PointLight(new THREE.Color(bounceCfg.color || '#ffe6c8'), bounceCfg.intensity ?? 6, 60, 2);
  bounce.position.fromArray(bounceCfg.position || [0, 2.5, 6]);

  return { sun, fill, rim, bounce, amb };
}
