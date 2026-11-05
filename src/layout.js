/**
 * 广州城市新中轴线 · 真实地理空间关系（1 unit = 1 m）
 * 坐标系：+X 东，+Y 上，+Z 北。原点约在临江大道 / 海心沙一线。
 * 自南向北：广州塔 → 珠江前航道 → 海心沙 → 临江大道 → 花城广场三大文化地标 → 东塔/西塔
 * 二沙岛与后航道位于轴线西侧。
 */
export const LAYOUT = {
  // 轴线
  axisX: 0,

  // 广州塔（南岸）
  cantonTower: { x: 0, z: -820, bodyH: 450, mastH: 604, bubbleY: 450 },

  // 珠江前航道（东西向）
  frontChannel: { zMin: -680, zMax: -430, xMin: -1100, xMax: 1100 },

  // 海心沙
  haixinsha: { xMin: -60, xMax: 140, zMin: -410, zMax: -230 },
  sailScreen: { x: 40, z: -380 },

  // 临江大道
  linjiangAve: { z: -180, halfWidth: 18 },

  // 花城广场
  huacheng: { xMin: -90, xMax: 90, zMin: -140, zMax: 300 },

  // 三大文化地标
  operaHouse: { x: -150, z: -60 },   // 广州大剧院「双砾」
  museum: { x: 145, z: 10 },         // 广东省博物馆「月光宝盒」
  library: { x: 125, z: 150 },       // 广州图书馆「之」形

  // 双塔（北端）
  ifc: { x: -115, z: 340, h: 432 },  // 西塔 IFC
  ctf: { x: 125, z: 385, h: 530 },   // 东塔 CTF

  // 二沙岛 + 后航道（西侧）
  ersha: { xMin: -620, xMax: -300, zMin: -360, zMax: 80 },
  xinghai: { x: -450, z: -80 },      // 星海音乐厅
  backChannel: { xMin: -980, xMax: -650, zMin: -520, zMax: 220 },

  // 三桥
  bridges: {
    haixin: { z: -520, xMin: -40, xMax: 80 },   // 海心桥（倾斜提篮拱 + S 形）
    liede: { z: -300, xMin: -220, xMax: 220 },  // 猎德大桥「珠江之贝」
    guangzhou: { z: 60, xMin: -560, xMax: -40 }, // 广州大桥
  },

  // 路网
  roads: {
    huachengAve: { x: 0, halfWidth: 22, zMin: -160, zMax: 420 }, // 中轴花城大道
    linjiang: { z: -180, halfWidth: 18, xMin: -900, xMax: 700 },
    jinsui: { z: 280, halfWidth: 20, xMin: -800, xMax: 700 },    // 金穗路
    huaxia: { x: -180, halfWidth: 14, zMin: -200, zMax: 480 },   // 华夏路
    lizhu: { x: 180, halfWidth: 14, zMin: -200, zMax: 480 },     // 珠江东路
    yanjiang: { z: -70, halfWidth: 10, xMin: -700, xMax: 700 },
  },

  // CBD 外扩范围
  city: { xMin: -1350, xMax: 1350, zMin: -1100, zMax: 1100 },
};

/** 高度衰减：沿中轴 1/(1+|x|/1350)，再叠加南北向 CBD 核区权重 */
export function heightFactor(x, z) {
  const lateral = 1 / (1 + Math.abs(x) / 1350);
  // 珠江新城核心（双塔—花城广场）权重最高
  const coreZ = Math.exp(-((z - 180) * (z - 180)) / (2 * 420 * 420));
  const southZ = Math.exp(-((z + 200) * (z + 200)) / (2 * 500 * 500)) * 0.45;
  return lateral * (0.35 + 0.65 * Math.max(coreZ, southZ));
}

/** 采样水面高度（用于桥面/驳岸） */
export const GROUND_Y = 0;
export const WATER_Y = 0;
