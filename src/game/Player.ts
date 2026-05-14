import { Camera } from '../engine/Camera.ts';
import { Input } from '../engine/Input.ts';
import { audioManager, type SoundName } from '../audio/AudioManager.ts';
import type { RaycastMap } from '../engine/Raycaster.ts';
import type { DoorState, EnemyState, PickupState } from './World.ts';

const MOVE_SPEED = 3.2;
const FOOTSTEP_INTERVAL = 0.38;
const INTERACT_REACH = 1.5;
const SHOOT_RANGE = 18;
const PICKUP_RADIUS = 0.6;

export class Player {
  camera: Camera;
  health = 100; maxHealth = 100;
  ammo = 30; totalAmmo = 120;
  readonly magSize = 30;

  private _footstepTimer = 0;
  private _footstepLeft = true;
  private _prevKeys = new Set<string>();
  private _shootCooldown = 0;
  private _reloading = false;
  private _reloadTimer = 0;
  private readonly RELOAD_TIME = 1.8;

  constructor(camera: Camera) {
    this.camera = camera;
    camera.x = 2; camera.z = 2; camera.yaw = 0;
  }

  update(
    dt: number, input: Input, map: RaycastMap,
    doors: DoorState[], enemies: EnemyState[], pickups: PickupState[],
    onShot: (hitEnemy: EnemyState | null) => void,
  ): void {
    if (this.health <= 0) return;
    this._handleMovement(dt, input, map);
    this._handleLook(input);
    this._handleReload(dt, input);
    this._handleShoot(dt, input, map, enemies, onShot);
    this._handleInteract(input, doors);
    this._handlePickups(pickups);
    this._syncAudio();
    this._prevKeys = new Set(input.keys);
    input.flush();
  }

  private _handleMovement(dt: number, input: Input, map: RaycastMap): void {
    const cam = this.camera;
    const fwd = cam.forwardXZ; const right = cam.rightXZ;
    let moveX = 0, moveZ = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) { moveX += fwd.x; moveZ += fwd.z; }
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) { moveX -= fwd.x; moveZ -= fwd.z; }
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) { moveX -= right.x; moveZ -= right.z; }
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) { moveX += right.x; moveZ += right.z; }
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX = (moveX / len) * MOVE_SPEED * dt;
      moveZ = (moveZ / len) * MOVE_SPEED * dt;
      const margin = 0.3;
      const nx = cam.x + moveX;
      if (!this._solid(nx, cam.z, map, margin)) cam.x = nx;
      const nz = cam.z + moveZ;
      if (!this._solid(cam.x, nz, map, margin)) cam.z = nz;
      this._footstepTimer -= dt;
      if (this._footstepTimer <= 0) {
        this._footstepTimer = FOOTSTEP_INTERVAL;
        const name: SoundName = this._footstepLeft ? 'footstep_left' : 'footstep_right';
        this._footstepLeft = !this._footstepLeft;
        audioManager.playSound(name, undefined, 0.06);
      }
    } else { this._footstepTimer = 0; }
  }

  private _solid(x: number, z: number, map: RaycastMap, margin: number): boolean {
    for (const [cx, cz] of [[x-margin,z-margin],[x+margin,z-margin],[x-margin,z+margin],[x+margin,z+margin]] as [number,number][]) {
      const mx = Math.floor(cx); const mz = Math.floor(cz);
      if (mx < 0 || mx >= map.width || mz < 0 || mz >= map.height) return true;
      if (map.cells[mz * map.width + mx] > 0) return true;
    }
    return false;
  }

  private _handleLook(input: Input): void {
    this.camera.applyMouseDelta(input.mouseDeltaX, input.mouseDeltaY);
  }

  private _handleReload(dt: number, input: Input): void {
    if (this._reloading) {
      this._reloadTimer -= dt;
      if (this._reloadTimer <= 0) {
        this._reloading = false;
        const needed = this.magSize - this.ammo;
        const transfer = Math.min(needed, this.totalAmmo);
        this.ammo += transfer; this.totalAmmo -= transfer;
      }
      return;
    }
    const justR = input.keys.has('KeyR') && !this._prevKeys.has('KeyR');
    if (justR && this.ammo < this.magSize && this.totalAmmo > 0) {
      this._reloading = true; this._reloadTimer = this.RELOAD_TIME;
      audioManager.playSound('reload');
    }
  }

  private _handleShoot(
    dt: number, input: Input, map: RaycastMap,
    enemies: EnemyState[], onShot: (hitEnemy: EnemyState | null) => void,
  ): void {
    if (this._reloading) return;
    this._shootCooldown = Math.max(0, this._shootCooldown - dt);
    if (!input.mouseButtonsJustPressed.has(0) || this._shootCooldown > 0) return;
    if (this.ammo <= 0) {
      audioManager.playSound('empty_click');
      this._shootCooldown = 0.4; return;
    }
    this.ammo--;
    this._shootCooldown = 0.18;
    audioManager.playSound('gunshot_pp7');
    const cam = this.camera;
    const rdx = Math.sin(cam.yaw); const rdz = Math.cos(cam.yaw);
    let closest: { enemy: EnemyState; dist: number } | null = null;
    for (const enemy of enemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.x - cam.x; const dz = enemy.z - cam.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > SHOOT_RANGE) continue;
      const along = dx * rdx + dz * rdz;
      if (along <= 0) continue;
      const perp = Math.abs(dx * rdz - dz * rdx);
      if (perp > 0.4 + dist * 0.05) continue;
      if (this._wallBetween(cam.x, cam.z, enemy.x, enemy.z, map)) continue;
      if (!closest || dist < closest.dist) closest = { enemy, dist };
    }
    onShot(closest?.enemy ?? null);
  }

  private _wallBetween(x1: number, z1: number, x2: number, z2: number, map: RaycastMap): boolean {
    const steps = 20;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const mx = Math.floor(x1 + (x2 - x1) * t); const mz = Math.floor(z1 + (z2 - z1) * t);
      if (mx < 0 || mz < 0 || mx >= map.width || mz >= map.height) return true;
      if (map.cells[mz * map.width + mx] === 1) return true;
    }
    return false;
  }

  private _handleInteract(input: Input, doors: DoorState[]): void {
    const justE = input.keys.has('KeyE') && !this._prevKeys.has('KeyE');
    if (!justE) return;
    const cam = this.camera;
    for (const door of doors) {
      const dx = door.cellX + 0.5 - cam.x; const dz = door.cellZ + 0.5 - cam.z;
      if (Math.sqrt(dx * dx + dz * dz) <= INTERACT_REACH) {
        const wasOpen = door.open; door.open = !door.open;
        audioManager.playSound(wasOpen ? 'door_close' : 'door_open', { x: door.cellX + 0.5, z: door.cellZ + 0.5 });
        return;
      }
    }
  }

  private _handlePickups(pickups: PickupState[]): void {
    const cam = this.camera;
    for (const p of pickups) {
      if (p.collected) continue;
      const dx = p.x - cam.x; const dz = p.z - cam.z;
      if (Math.sqrt(dx * dx + dz * dz) < PICKUP_RADIUS) {
        p.collected = true;
        if (p.type === 'ammo') this.totalAmmo = Math.min(this.totalAmmo + 30, 240);
        else this.health = Math.min(this.health + 30, this.maxHealth);
        audioManager.playSound('pickup');
      }
    }
  }

  private _syncAudio(): void {
    audioManager.playerPos = { x: this.camera.x, z: this.camera.z };
    audioManager.playerYaw = this.camera.yaw;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    audioManager.playSound('player_hurt');
  }
}
