// G5 performance benchmark: warmup 1x + >=7 repeats, report median + cold start.
// Writes bench/result.json with min/median/p95/stddev + cold measurement.

import { readFileSync, writeFileSync } from "node:fs";
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

// cold start (first run, JIT not warm) measured separately
const t0 = performance.now();
core.smoothVolumePreserved(pos, idx, ITER, 0.5);
const coldMs = performance.now() - t0;

// warmup (thrown away)
core.smoothVolumePreserved(pos, idx, ITER, 0.5);

function run() {
  const s = performance.now();
  core.smoothVolumePreserved(pos, idx, ITER, 0.5);
  return performance.now() - s;
}

const REPS = 9;
const samples = [];
for (let i = 0; i < REPS; i++) samples.push(run());
samples.sort((a, b) => a - b);

const median = samples[Math.floor(REPS / 2)];
const min = samples[0];
const p95 = samples[Math.ceil(REPS * 0.95) - 1];
const mean = samples.reduce((a, b) => a + b, 0) / REPS;
const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / REPS;
const stddev = Math.sqrt(variance);
const relStd = stddev / mean;

// measurable output (also used by README evidence)
const ref = core.signedVolume(pos, idx);
const naive = core.naiveSmooth(pos, idx, ITER, 0.5);
const preserved = core.smoothVolumePreserved(pos, idx, ITER, 0.5);
const naiveDrift = core.volumeDrift(naive, idx, ref);
const preservedDrift = core.volumeDrift(preserved, idx, ref);

const result = {
  suite: "volume-preserving smoothing",
  sample: "bumpy-sphere.json",
  iterations: ITER,
  reps: REPS,
  coldStartMs: coldMs,
  minMs: min,
  medianMs: median,
  p95Ms: p95,
  stddevMs: stddev,
  relStddev: relStd,
  samplesMs: samples,
  // numeric results (node-verifiable, also shown in browser)
  naiveDrift,
  preservedDrift,
  suppression: Math.abs(naiveDrift) / Math.abs(preservedDrift),
  refVolume: ref,
};

writeFileSync(join(here, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));