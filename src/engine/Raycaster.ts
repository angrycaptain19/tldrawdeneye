import type { Camera } from './Camera.ts';

export interface RaycastMap {
  width: number;
  height: number;
  cells: Uint8Array;
}

interface HitInfo {
  dist: number;
  wallX: number;
  side: 0 | 1;
  cellX: number;
  cellZ: number;
  cellType: number;
}

export class Raycaster {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private imageData: ImageData;
  private zbuffer: Float32Array;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');
    this.ctx2d = ctx;
    this.imageData = ctx.createImageData(canvas.width, canvas.height);
    this.zbuffer = new Float32Array(canvas.width);
  }

  resize(): void {
    this.imageData = this.ctx2d.createImageData(this.canvas.width, this.canvas.height);
    this.zbuffer = new Float32Array(this.canvas.width);
  }

  render(camera: Camera, map: RaycastMap): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const data = this.imageData.data;

    for (let y = 0; y < H; y++) {
      const isCeiling = y < H / 2;
      const shade = isCeiling ? Math.round(25 + (y / (H / 2)) * 20) : Math.round(40 - ((y - H / 2) / (H / 2)) * 15);
      const r = isCeiling ? shade : shade + 10;
      const g = isCeiling ? shade : shade + 8;
      const b = isCeiling ? shade + 5 : shade;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }

    for (let col = 0; col < W; col++) {
      const cameraX = (2 * col) / W - 1;
      const rayDirX = Math.sin(camera.yaw) + Math.cos(camera.yaw) * cameraX;
      const rayDirZ = Math.cos(camera.yaw) - Math.sin(camera.yaw) * cameraX;
      const hit = this._castRay(camera.x, camera.z, rayDirX, rayDirZ, map);
      if (!hit) { this.zbuffer[col] = Infinity; continue; }
      this.zbuffer[col] = hit.dist;
      const lineH = Math.min(H, Math.round(H / hit.dist));
      const drawStart = Math.max(0, Math.round((H - lineH) / 2));
      const drawEnd = Math.min(H - 1, Math.round((H + lineH) / 2));
      const brightness = Math.max(0, Math.min(1, 1 - hit.dist / 18));
      const sideShade = hit.side === 1 ? 0.65 : 1.0;
      const cellColour = this._cellColour(hit.cellType);
      const r = Math.round(cellColour[0] * brightness * sideShade);
      const g = Math.round(cellColour[1] * brightness * sideShade);
      const b = Math.round(cellColour[2] * brightness * sideShade);
      for (let row = drawStart; row <= drawEnd; row++) {
        const i = (row * W + col) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }

    this.ctx2d.putImageData(this.imageData, 0, 0);
  }

  private _castRay(px: number, pz: number, rdx: number, rdz: number, map: RaycastMap): HitInfo | null {
    let mapX = Math.floor(px);
    let mapZ = Math.floor(pz);
    const deltaDistX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
    const deltaDistZ = rdz === 0 ? 1e30 : Math.abs(1 / rdz);
    let stepX: number, stepZ: number, sideDistX: number, sideDistZ: number;
    if (rdx < 0) { stepX = -1; sideDistX = (px - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1 - px) * deltaDistX; }
    if (rdz < 0) { stepZ = -1; sideDistZ = (pz - mapZ) * deltaDistZ; }
    else { stepZ = 1; sideDistZ = (mapZ + 1 - pz) * deltaDistZ; }
    let side: 0 | 1 = 0;
    for (let step = 0; step < 64; step++) {
      if (sideDistX < sideDistZ) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else { sideDistZ += deltaDistZ; mapZ += stepZ; side = 1; }
      if (mapX < 0 || mapX >= map.width || mapZ < 0 || mapZ >= map.height) return null;
      const cell = map.cells[mapZ * map.width + mapX];
      if (cell > 0) {
        const dist = side === 0 ? (mapX - px + (1 - stepX) / 2) / rdx : (mapZ - pz + (1 - stepZ) / 2) / rdz;
        const wallX = side === 0 ? pz + dist * rdz - Math.floor(pz + dist * rdz) : px + dist * rdx - Math.floor(px + dist * rdx);
        return { dist, wallX, side, cellX: mapX, cellZ: mapZ, cellType: cell };
      }
    }
    return null;
  }

  private _cellColour(type: number): [number, number, number] {
    switch (type) {
      case 1: return [180, 160, 110];
      case 2: return [120, 100, 80];
      case 3: return [80, 80, 160];
      default: return [150, 150, 150];
    }
  }

  getZBuffer(): Float32Array { return this.zbuffer; }
}
