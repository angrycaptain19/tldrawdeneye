import { audioManager } from '../audio/AudioManager.ts';
import type { EnemyState } from './World.ts';
import type { RaycastMap } from '../engine/Raycaster.ts';
import type { Camera } from '../engine/Camera.ts';

const DETECTION_RANGE = 9;
const ATTACK_RANGE = 7;
const CHASE_SPEED = 1.6;
const SHOOT_COOLDOWN = 2.2;
const ALERT_TIME = 0.8;

export class EnemySystem {
  update(
    dt: number,
    enemies: EnemyState[],
    playerCam: Camera,
    map: RaycastMap,
    onEnemyShoot: (enemy: EnemyState) => void,
  ): void {
    const px = playerCam.x;
    const pz = playerCam.z;
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const dx = px - e.x; const dz = pz - e.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      e.shootCooldown = Math.max(0, e.shootCooldown - dt);

      switch (e.state) {
        case 'idle':
          e.waypointTimer += dt;
          if (dist < DETECTION_RANGE && this._hasLOS(e, px, pz, map)) {
            e.state = 'alert'; e.alertTimer = 0;
            audioManager.playSound('enemy_alert', { x: e.x, z: e.z });
          }
          break;
        case 'alert':
          e.alertTimer += dt;
          if (e.alertTimer >= ALERT_TIME) e.state = 'chase';
          if (dist > DETECTION_RANGE * 1.4) e.state = 'idle';
          break;
        case 'chase':
          this._moveTowardPlayer(e, dt, dx, dz, dist, map);
          if (dist < ATTACK_RANGE && e.shootCooldown <= 0 && this._hasLOS(e, px, pz, map)) {
            e.shootCooldown = SHOOT_COOLDOWN;
            audioManager.playSound('gunshot_kf7', { x: e.x, z: e.z });
            onEnemyShoot(e);
          }
          if (dist > DETECTION_RANGE * 2) e.state = 'idle';
          break;
      }
    }
  }

  private _moveTowardPlayer(e: EnemyState, dt: number, dx: number, dz: number, dist: number, map: RaycastMap): void {
    if (dist < 0.8) return;
    const nx = e.x + (dx / dist) * CHASE_SPEED * dt;
    const nz = e.z + (dz / dist) * CHASE_SPEED * dt;
    const mx = Math.floor(nx); const mz = Math.floor(nz);
    if (mx >= 0 && mz >= 0 && mx < map.width && mz < map.height && map.cells[mz * map.width + mx] === 0) {
      e.x = nx; e.z = nz;
    }
  }

  private _hasLOS(e: EnemyState, px: number, pz: number, map: RaycastMap): boolean {
    const steps = 16;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const mx = Math.floor(e.x + (px - e.x) * t);
      const mz = Math.floor(e.z + (pz - e.z) * t);
      if (mx < 0 || mz < 0 || mx >= map.width || mz >= map.height) return false;
      if (map.cells[mz * map.width + mx] === 1) return false;
    }
    return true;
  }

  hitEnemy(enemy: EnemyState, damage: number): boolean {
    if (enemy.state === 'dead') return false;
    enemy.health -= damage;
    if (enemy.health <= 0) {
      enemy.health = 0; enemy.state = 'dead';
      audioManager.playSound('enemy_death', { x: enemy.x, z: enemy.z });
      return true;
    }
    if (enemy.state === 'idle') {
      enemy.state = 'alert'; enemy.alertTimer = 0;
      audioManager.playSound('enemy_alert', { x: enemy.x, z: enemy.z });
    }
    return false;
  }
}
