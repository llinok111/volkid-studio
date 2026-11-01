// Deterministic sample generator: a bumpy sphere with unequal edge lengths.
// Deterministic: fixed seeds -> identical bytes every run.
// Output: data/bumpy-sphere.json  { positions:number[], indices:number[] }

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Small deterministic PRNG (m_u_l_b_e_r_r_y32).
function m_u_l_b_e_r_r_y32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sphere with sinusoidal + pseudo-random radial bumps, parametrized (u,v).
// u in [0,2pi], v in [0,pi]. Deformed so edges are unequal -> smoothing needed.
function bumpySpherePoint(rand, u, v) {
  const r = 1.0
    + 0.18 * Math.sin(3 * u) * Math.sin(2 * v)
    + 0.10 * Math.cos(5 * u + 1.3) * Math.sin(3 * v + 0.4)
    + 0.06 * Math.sin(7 * u + 2.1) * Math.cos(4 * v);
  const x = r * Math.sin(v) * Math.cos(u);
  const y = r * Math.cos(v);
  const z = r * Math.sin(v) * Math.sin(u);
  return [x, y, z];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "data");

export function generate(segU = 48, segV = 32) {
  const rand = m_u_l_b_e_r_r_y32(0x5eed);
  const positions = [];
  const indices = [];
  const N = segU + 1, M = segV + 1;
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i / segU) * 2 * Math.PI;
      const v = (j / segV) * Math.PI;
      // deterministic per-cell jitter derived from rng + coords, no over-deform poles
      const jx = (rand() - 0.5) * 0.02;
      const jy = (rand() - 0.5) * 0.02;
      const jz = (rand() - 0.5) * 0.02;
      const p = bumpySpherePoint(rand, u, v);
      positions.push(p[0] + jx, p[1] + jy, p[2] + jz);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * N + i, b = a + 1, c = (j + 1) * N + i, d = c + 1;
      indices.push(a, b, d, a, d, c); // outward winding
    }
  }
  return { positions, indices };
}

// CLI / run wrapper.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { positions, indices } = generate();
  mkdirSync(outDir, { recursive: true });
  const out = { positions, indices, segU: 48, segV: 32 };
  const file = join(outDir, "bumpy-sphere.json");
  writeFileSync(file, JSON.stringify(out));
  console.log(`wrote ${file}: ${indices.length / 3} tris, ${positions.length / 3} verts`);
}