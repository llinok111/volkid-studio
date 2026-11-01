// VolumeInfo: pure geometry primitives for mesh smoothing + volume preservation.
// No three, no DOM, no I/O. Deterministic; usable in node and browser verbatim.

/** Signed volume of a closed, consistently-oriented triangle mesh (divergence
 *  theorem). Positions Float32Array len 3N, indices Uint32Array len 3T.
 *  Positive when outward normal fan with counter-clockwise winding. */
export function signedVolume(positions, indices) {
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t] * 3, i1 = indices[t + 1] * 3, i2 = indices[t + 2] * 3;
    const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
    const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
    const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];
    // u = b - a, v = c - a; contribution = dot(a, cross(u,v)) / 6
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const crx = uy * vz - uz * vy;
    const cry = uz * vx - ux * vz;
    const crz = ux * vy - uy * vx;
    vol += ax * crx + ay * cry + az * crz;
  }
  return vol / 6;
}

/** Relative signed-volume change, fraction (0 = unchanged). */
export function volumeDrift(positions, indices, refVolume) {
  const v = signedVolume(positions, indices);
  return (v - refVolume) / Math.abs(refVolume);
}

/** vertex -> neighbor index list. For each triangle (a,b,c) each vertex is a
 *  neighbor of the other two; duplicates are fine for a uniform umbrella mean. */
export function adjacency(indices, vertexCount) {
  const deg = new Uint32Array(vertexCount);
  for (let t = 0; t < indices.length; t++) deg[indices[t]] += 2; // two neighbors per corner
  const offsets = new Uint32Array(vertexCount + 1);
  for (let i = 0; i < vertexCount; i++) offsets[i + 1] = offsets[i] + deg[i];
  const nbrs = new Uint32Array(offsets[vertexCount]);
  const fill = new Uint32Array(vertexCount);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    // a's neighbors b,c ; b's neighbors a,c ; c's neighbors a,b
    nbrs[offsets[a] + fill[a]++] = b; nbrs[offsets[a] + fill[a]++] = c;
    nbrs[offsets[b] + fill[b]++] = a; nbrs[offsets[b] + fill[b]++] = c;
    nbrs[offsets[c] + fill[c]++] = a; nbrs[offsets[c] + fill[c]++] = b;
  }
  return { offsets, nbrs };
}

/** One umbrella (uniform Laplacian) relax step toward neighbors. */
export function relax(positions, indices, outs, lambda, adj) {
  const n = positions.length / 3;
  const { offsets, nbrs } = adj;
  for (let v = 0; v < n; v++) {
    const o0 = offsets[v], o1 = offsets[v + 1];
    const d = o1 - o0;
    if (d === 0) { outs[v * 3] = positions[v * 3]; outs[v * 3 + 1] = positions[v * 3 + 1]; outs[v * 3 + 2] = positions[v * 3 + 2]; continue; }
    let sx = 0, sy = 0, sz = 0;
    for (let k = o0; k < o1; k++) { const vk = nbrs[k] * 3; sx += positions[vk]; sy += positions[vk + 1]; sz += positions[vk + 2]; }
    const inv = 1 / d;
    const mx = sx * inv, my = sy * inv, mz = sz * inv;
    outs[v * 3] = positions[v * 3] + lambda * (mx - positions[v * 3]);
    outs[v * 3 + 1] = positions[v * 3 + 1] + lambda * (my - positions[v * 3 + 1]);
    outs[v * 3 + 2] = positions[v * 3 + 2] + lambda * (mz - positions[v * 3 + 2]);
  }
}

/** Uniformly rescale all vertices by factor s (about barycenter). */
export function rescale(positions, outs, s) {
  const n = positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let v = 0; v < n; v++) { cx += positions[v * 3]; cy += positions[v * 3 + 1]; cz += positions[v * 3 + 2]; }
  const inv = 1 / n;
  cx *= inv; cy *= inv; cz *= inv;
  for (let v = 0; v < n; v++) {
    outs[v * 3] = cx + (positions[v * 3] - cx) * s;
    outs[v * 3 + 1] = cy + (positions[v * 3 + 1] - cy) * s;
    outs[v * 3 + 2] = cz + (positions[v * 3 + 2] - cz) * s;
  }
  return { cx, cy, cz };
}

/** Naive umbrella Laplacian smoothing (shrinks surface). Pure. */
export function naiveSmooth(positions, indices, iterations, lambda = 0.5) {
  const bufA = new Float32Array(positions);
  const bufB = new Float32Array(positions.length);
  const adj = adjacency(indices, positions.length / 3);
  let src = bufA, dst = bufB;
  for (let it = 0; it < iterations; it++) {
    relax(src, indices, dst, lambda, adj);
    const t = src; src = dst; dst = t;
  }
  return src;
}

/** Volume-preserving smooth: naive relax + divergence-theorem volume restore.
 *  Uniformly rescale about barycenter each iteration to match target volume. */
export function smoothVolumePreserved(positions, indices, iterations, lambda = 0.5) {
  const target = signedVolume(positions, indices);
  const work = new Float32Array(positions);
  const scratch = new Float32Array(positions.length);
  const adj = adjacency(indices, positions.length / 3);
  for (let it = 0; it < iterations; it++) {
    relax(work, indices, scratch, lambda, adj);
    const vCur = signedVolume(scratch, indices);
    // uniform rescale about barycenter: volume scales as s^3 -> use cube root
    const s = Math.cbrt(target / vCur);
    rescale(scratch, work, s);
  }
  return work;
}

/** Full measurable suite. Returns metrics object used by node verify + bench. */
export function runSuite(positions, indices, iterations = 300, lambda = 0.5) {
  const ref = signedVolume(positions, indices);
  const naive = naiveSmooth(positions, indices, iterations, lambda);
  const preserved = smoothVolumePreserved(positions, indices, iterations, lambda);
  const naiveDrift = volumeDrift(naive, indices, ref);
  const preservedDrift = volumeDrift(preserved, indices, ref);
  return {
    refVolume: ref,
    naiveDrift,
    preservedDrift,
    suppression: Math.abs(naiveDrift) / Math.abs(preservedDrift),
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    iterations,
  };
}