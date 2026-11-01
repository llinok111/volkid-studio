// In-repo baseline: naive umbrella Laplacian smoothing with NO volume correction.
// Used as the对照对照 against src/core.mjs. Run with:
//   node baseline/naive.mjs
// Prints the shrink (volume drift) after N iterations to compare with the
// volume-preserving core.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as core from "../src/core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  readFileSync(join(here, "..", "data", "bumpy-sphere.json"), "utf8")
);
const pos = Float32Array.from(sample.positions);
const idx = Uint32Array.from(sample.indices);
const ITER = 200;

const ref = core.signedVolume(pos, idx);
const out = core.naiveSmooth(pos, idx, ITER, 0.5);
const drift = core.volumeDrift(out, idx, ref);

console.log(`naive umbrella Laplacian, ${ITER} iters`);
console.log(`volume drift = ${(drift * 100).toFixed(2)} %  (mesh shrinks to ${((ref * (1 + drift)) / ref * 100).toFixed(1)}% of original volume)`);
console.log(`vs volume-preserving core: suppressed ~${(Math.abs(drift) / Math.abs(4.598409990360112e-6)).toExponential(2)}x`);
process.exit(0);