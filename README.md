# 体素广州 · 新中轴 | Voxel Guangzhou Central Axis

原生 Three.js（ES6 模块）体素风格三维场景：广州城市新中轴线（珠江新城—广州塔核心区）。
1 unit = 1 m 等比真实尺度。夜景为默认主视觉，日景对照。

## 运行

```bash
npm install
npm run dev          # http://127.0.0.1:5177
npm run build        # 常规构建 dist/
npm run build:single # 单文件 HTML（内联 three.js，双击可开）
npm run verify       # 无头浏览器验证 + 截图
```

单文件产物：`体素广州-新中轴.html`

## 空间关系（南 → 北）

广州塔 → 珠江前航道 → 海心沙 → 临江大道 → 花城广场三大文化地标 → 东塔(CTF 530m)/西塔(IFC 432m)
二沙岛与后航道位于轴线西侧。

## 模块

| 模块 | 职责 |
|---|---|
| `CityScene` | 场景编排 / 昼夜雾色 |
| `VoxelCity` | ≥1500 栋体素楼、窗光、屋顶繁华、光流车流、全息广告 |
| `CantonTowerMesh` | 广州塔逐层体素环、外骨骼、彩虹霓虹、摩天轮、障碍灯 |
| `CentralAxisBuildings` | 双塔、大剧院、博物馆、图书馆、帆屏、二沙岛树、星海 |
| `RiverSystem` | 分块体素波 + 平面镜像反射（斜剪切面 / HalfFloat / 隔帧） |
| `Bridges` | 海心桥 / 猎德大桥 / 广州大桥 |
| `SkyEnvironment` | 天空辉光、星空、探照灯、昼夜光照 |
| `PostEffects` | Bloom + 暗角/饱和 + SMAA |
| `CameraRig` | 镜头 A–E、缓动补间、自动环绕、键盘 1–5 |
| `geo/*` | `voxelBox` 等体素工具、CanvasTexture 窗光、InstancedMesh 合批 |
| `core/shared.js` | 全局 `uTime` / `uNight` 等共享 uniform，`onBeforeCompile` 注入 |

## 交互

- 拖拽旋转 · 滚轮缩放
- 键盘 `1`–`5` 切镜：A 塔顶鸟瞰 / B 塔下仰望 / C 中轴漫游 / D 珠江全景 / E 二沙岛
- 右上角 lil-gui：昼夜 mix、曝光、霓虹四参数、车流密度、波纹/倒影、Bloom、SMAA、镜头
- HUD：FPS / draw call / 三角面 / 建筑数

## 技术要点

- 所有建筑由 `InstancedMesh` 单位立方体批量拼装（`voxelBox(x,y,z,w,h,d,color)`）
- 立面窗格发光贴图为程序化 `CanvasTexture`，亮灯率 / 色温 / 楼层分组随 seed 变化，夜景 ≥55% 亮灯并缓慢换灯
- 车流为 GPU shader 双向光粒子河（金红双色）
- 全局仅 `uTime` / `uNight` 两个时间与昼夜源


## 公开源码版本

此仓库为 2026-11-05 的源码快照。保留可运行入口、源码、构建配置和已有测试；本地依赖、缓存、历史打包文件和验收截图未随仓库发布。README 中较早的测试数字属于历史记录；本次发布的验证结果见 `PUBLICATION.md`。场景为实验性作品，欢迎提交可复现的问题及改进。

开发环境建议使用 Node.js 22 或更新的受支持版本。在仓库目录执行 `npm ci` 安装锁定依赖，再按上面的命令运行或构建。独立 HTML（如存在）可直接下载打开。

自有代码及文档采用 [MIT License](LICENSE)，允许使用、修改与再分发。第三方组件保持其原有许可证，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。


---

[全部开源项目](https://github.com/129kkkl/workspace-catalog) · [贡献指南](CONTRIBUTING.md) · [安全报告](SECURITY.md)
