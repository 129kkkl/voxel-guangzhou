/**
 * CityScene：场景编排
 * 模块：VoxelCity / CantonTowerMesh / CentralAxisBuildings / RiverSystem / Bridges / SkyEnvironment
 */
import * as THREE from 'three';
import { shared } from './core/shared.js';
import { VoxelCity, TrafficRivers } from './VoxelCity.js';
import { CantonTowerMesh } from './CantonTowerMesh.js';
import { CentralAxisBuildings } from './CentralAxisBuildings.js';
import { RiverSystem } from './RiverSystem.js';
import { Bridges } from './Bridges.js';
import { SkyEnvironment } from './SkyEnvironment.js';
import { LAYOUT } from './layout.js';

export class CityScene {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a14);
    this.scene.fog = new THREE.FogExp2(0x080c18, 0.0001);
    this.buildingCount = 0;
    this.treeCount = 0;
  }

  build() {
    // 天空 / 光照
    this.sky = new SkyEnvironment();
    this.scene.add(this.sky.build());

    // 城市肌理
    this.city = new VoxelCity();
    this.scene.add(this.city.build());
    this.buildingCount = this.city.buildingCount;

    // 光流车流
    this.traffic = new TrafficRivers();
    this.scene.add(this.traffic.build());

    // 广州塔
    this.tower = new CantonTowerMesh();
    this.scene.add(this.tower.build());

    // 中轴地标
    this.axis = new CentralAxisBuildings();
    this.scene.add(this.axis.build());
    this.treeCount = this.axis.treeCount;

    // 珠江
    this.river = new RiverSystem(this.renderer);
    this.scene.add(this.river.build());

    // 三桥
    this.bridges = new Bridges();
    this.scene.add(this.bridges.build());

    // 夜景雾色
    this._applyFog();
    return this.scene;
  }

  _applyFog() {
    const n = shared.uNight.value;
    const day = 1 - n;
    // 只做远景色调融合，绝不能糊掉体素轮廓
    const nightFog = new THREE.Color(0x080c18);
    const dayFog = new THREE.Color(0x88a0b8);
    const c = nightFog.clone().lerp(dayFog, day);
    if (this.scene.fog) {
      this.scene.fog.color.copy(c);
      this.scene.fog.density = 0.00008 + n * 0.00006;
    }
    this.scene.background.copy(c).multiplyScalar(0.55 + day * 0.35);
  }

  update(dt, t, camera) {
    shared.uTime.value = t;
    this.sky.update();
    this.sky.updateBeams(t);
    this._applyFog();
    this.river.updateReflections(this.scene, camera);
  }

  get stats() {
    return {
      buildings: this.buildingCount,
      trees: this.treeCount,
      voxels: this.city?.voxelCounts,
    };
  }
}
