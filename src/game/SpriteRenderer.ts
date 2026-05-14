import type { Camera } from '../engine/Camera.ts';
import type { EnemyState, PickupState } from './World.ts';

export class SpriteRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    enemies: EnemyState[],
    pickups: PickupState[],
    zbuffer: Float32Array,
  ): void {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    type Sprite = { x: number; z: number; dist: number; kind: 'enemy' | 'ammo' | 'health'; state?: string; };
    const sprites: Sprite[] = [];

    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const dx = e.x - camera.x; const dz = e.z - camera.z;
      sprites.push({ x: e.x, z: e.z, dist: dx * dx + dz * dz, kind: 'enemy', state: e.state });
    }
    for (const p of pickups) {
      if (p.collected) continue;
      const dx = p.x - camera.x; const dz = p.z - camera.z;
      sprites.push({ x: p.x, z: p.z, dist: dx * dx + dz * dz, kind: p.type });
    }
    sprites.sort((a, b) => b.dist - a.dist);

    for (const sp of sprites) {
      const dx = sp.x - camera.x; const dz = sp.z - camera.z;
      const invDet = 1 / (Math.cos(camera.yaw) ** 2 + Math.sin(camera.yaw) ** 2);
      const camX = invDet * (Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz);
      const camZ = invDet * (Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz);
      if (camZ <= 0.1) continue;
      const screenX = Math.round((W / 2) * (1 + camX / camZ));
      const spriteH = Math.abs(Math.round(H / camZ));
      const drawStartY = Math.max(0, Math.round((H - spriteH) / 2));
      const drawEndY = Math.min(H - 1, Math.round((H + spriteH) / 2));
      const drawStartX = Math.max(0, Math.round(screenX - spriteH / 2));
      const drawEndX = Math.min(W - 1, Math.round(screenX + spriteH / 2));
      let color: string;
      if (sp.kind === 'enemy') { color = sp.state === 'alert' || sp.state === 'chase' ? '#e85' : '#5a9'; }
      else if (sp.kind === 'ammo') { color = '#fb3'; }
      else { color = '#f55'; }
      for (let sx = drawStartX; sx <= drawEndX; sx++) {
        if (camZ >= zbuffer[sx]) continue;
        ctx.fillStyle = color;
        ctx.fillRect(sx, drawStartY, 1, drawEndY - drawStartY);
      }
      if (camZ < 8 && sp.kind === 'enemy') {
        ctx.fillStyle = sp.state === 'chase' ? '#f44' : '#fc4';
        ctx.font = '10px monospace'; ctx.textAlign = 'center';
        const labelY = drawStartY - 4;
        if (labelY > 0) ctx.fillText(sp.state === 'chase' ? '!' : '?', screenX, labelY);
      }
    }
  }
}
