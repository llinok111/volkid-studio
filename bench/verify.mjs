// G4 assertions: imports src/core.mjs, runs on generated sample, checks real numbers.
// Exit 0 only if every assertion passes; each prints its actual measured value.

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
const LAMBDA = 0.5;

const ref = core.signedVolume(pos, idx);
const naive = core.naiveSmooth(pos, idx, ITER, LAMBDA);
const preserved = core.smoothVolumePreserved(pos, idx, ITER, LAMBDA);

const naiveDrift = core.volumeDrift(naive, idx, ref);
const preservedDrift = core.volumeDrift(preserved, idx, ref);
const suppression = Math.abs(naiveDrift) / Math.abs(preservedDrift);

let ok = true;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}  [actual: ${detail}]`);
  if (!cond) ok = false;
}

check(
  "sample is a closed, consistent-volume mesh (V>0)",
  ref > 0,
  `refVolume=${ref.toExponential(6)}`
);
check(
  "baseline naive smoothing collapses volume substantially",
  naiveDrift < -0.5,
  `naiveDrift=${naiveDrift.toPrecision(4)} (${(naiveDrift * 100).toFixed(1)}%)`
);
check(
  "volume-preserved drift fraction <= 0.0001",
  Math.abs(preservedDrift) <= 1e-4,
  `preservedDrift=${preservedDrift.toExponential(4)} (${(Math.abs(preservedDrift) * 100).toExponential(3)}%)`
);
check(
  "suppression (|naive|/|preserved|) >= 1e4",
  suppression >= 1e4,
  `suppression=${suppression.toExponential(4)}`
);
check(
  "vertex/triangle counts sane",
  pos.length / 3 === 1617 && idx.length / 3 === 3072,
  `verts=${pos.length / 3}, tris=${idx.length / 3}`
);

console.log(ok ? "\nALL ASSERTS PASS" : "\nASSERT FAILURE");
process.exit(ok ? 0 : 1);