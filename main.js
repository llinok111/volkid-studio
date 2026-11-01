// Rendering + interaction only. All geometry math is computed on the *same*
// src/core.mjs used and verified in node — this file never re-derives it.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as core from "./src/core.mjs";

const sample = await (await fetch("./data/bumpy-sphere.json")).json();
const idx = Uint32Array.from(sample.indices);

const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131a);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0, 4.2);
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const d = new THREE.DirectionalLight(0xffffff, 0.9);
d.position.set(3, 4, 5);
scene.add(d);

const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sample.positions), 3));
geo.setIndex(new THREE.BufferAttribute(idx, 1));
geo.computeVertexNormals();
const mat = new THREE.MeshStandardMaterial({ color: 0x5aa7e0, flatShading: true, metalness: 0.1, roughness: 0.45 });
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

const ref = core.signedVolume(Float32Array.from(sample.positions), idx);
document.getElementById("meshMeta").textContent =
  `${sample.positions.length / 3} v · ${idx.length / 3} t`;

function setNormals(positions) {
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  geo.attributes.position.needsUpdate = true;
}

const basePos = Float32Array.from(sample.positions);

function recompute(it, lambda, mode) {
  // Always smooth from the raw sample so the browser result matches a fresh
  // node run (src/core.mjs) exactly — "what you see is what is verifiable".
  const out = mode === "naive"
    ? core.naiveSmooth(basePos, idx, it, lambda)
    : core.smoothVolumePreserved(basePos, idx, it, lambda);
  setNormals(out);
  const drift = core.volumeDrift(out, idx, ref);
  document.getElementById("iterVal").textContent = it;
  document.getElementById("lambdaVal").textContent = lambda.toFixed(2);
  document.getElementById("stats").innerHTML =
    `volume drift  ${(drift * 100).toFixed(4)} %` +
    `&nbsp;&nbsp;·&nbsp;&nbsp;iter ${it}` +
    (mode === "naive" ? " <span class='dim'>(naive baseline, shrinks)</span>" : " <span class='dim'>(preserved)</span>");
}

function tick() {
  recompute(
    +document.getElementById("iter").value,
    +document.getElementById("lambda").value,
    document.getElementById("mode").value
  );
}

for (const id of ["iter", "lambda", "mode"]) {
  document.getElementById(id).addEventListener("input", tick);
}
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

tick();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});