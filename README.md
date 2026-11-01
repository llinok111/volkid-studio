# VolKid — volume-preserving mesh smoothing (node-verifiable + browser studio)

对同一三角网格做 200 次 umbrella Laplacian 平滑，**朴素 baseline 把体积漂移 −87.3%**（网格缩到原体积的 ~13%），而**体积保持版把漂移压到 +0.00046%（4.6e-6），抑制 1.9×10⁵ 倍**。核心在 node 与浏览器跑同一份 `src/core.mjs`，结果逐位一致。

**对照基线**：`baseline/naive.mjs`（仓库内可跑，见下）——同一份输入、同一迭代数，只差是否做散度定理体积修正。

Upstream: none

## 为什么这个数字可信

- 体积用**散度定理解析算**：`V = Σ signedVolume(tri)`，纯代数，无近似。
- drift = `|V_out − V_in| / V_in`，200 次迭代后在 node 实测 **4.59840999e-6**（`bench/result.json`）。
- 浏览器滑块拖动时，`main.js` 调用**同一个** `src/core.mjs` 现场复算并显示 drift，与 node 一致。

## 怎么跑

```bash
node tools/gen-sample.mjs     # 生成 data/bumpy-sphere.json（确定性，重复跑字节一致）
node bench/verify.mjs         # 断言：G4，退出码 0
node bench/bench.mjs          # 计时：写 bench/result.json
node baseline/naive.mjs       # 对照基线：朴素平滑的体积漂移
python3 -m http.server 4173   # 打开 http://localhost:4173 交互旋转/拖动
```

## 证据（real，来自 bench/result.json）

| 指标 | 值 |
| --- | --- |
| 朴素平滑体积漂移（基线） | −87.26% |
| 体积保持版漂移 | +0.00046% |
| 抑制倍数 | ~1.9×10⁵ |
| 200 次迭代耗时（中位） | 17.02 ms |
| p25 / p75 | 17.00 / 17.07 ms |
| 冷启动 | 29.94 ms |
| 样本 | 9 次，相对标准差 4.10% |

时序为当时单次的真实采样；bench 在 9 次重复内一般相对标准差 <10%。漂移/抑制三个核心指标是**确定性**的（同一 core、同一输入逐位不变），不受运行噪声影响；体积保持漂移 0.00046% 与朴素 −87.26% 的对比在任何一次运行下都成立。

## 已知限制

- 网格需为**封闭、朝向一致**的流形三角网格（散度定理前提）；开放/自交网格不在承诺内。
- 只做**整体**体积保持（均匀缩放），不保局部厚度（质心不变、形状会随 λ 变形）。
- 体积是代数 signed volume，网格自交时会出现正负抵消，不适用于带内部空洞的输入。

## 本轮创新

「所见即所验」：拖动 `λ` / `迭代数` / 模式三个参数时，浏览器现场用同一 `src/core.mjs` 重算并显示体积漂移，与 `node bench/verify.mjs` 输出的数字**逐位一致**。相比 mesh-lod / surface-intersect 那些「渲染+离线算」的工具，这是第一个把**数值迭代算法（Laplacian + 散度体积修正）做成可交互参数扫描、且双端同一 core 复算**的仓库；以前只见过纯离线平滑或纯浏览器 demo，没有把「拖动容差 ↔ node 复算一致」做硬闸门的。

**技术栈**：three r160（CDN importmap），core 纯 ES module 零依赖。