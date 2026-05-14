import type { RaycastMap } from '../engine/Raycaster.ts';

export interface DoorState {
  cellX: number; cellZ: number;
  open: boolean; progress: number; cooldown: number;
}

export interface EnemyState {
  id: number; x: number; z: number;
  health: number; maxHealth: number;
  state: 'idle' | 'alert' | 'chase' | 'dead';
  alertTimer: number; waypointIdx: number; waypointTimer: number; shootCooldown: number;
}

export interface PickupState {
  id: number; x: number; z: number;
  type: 'ammo' | 'health'; collected: boolean;
}

export const MAP_DATA = [
  '111111111111111111111111',
  '100000000001000000000001',
  '100100000001000001001001',
  '100100011001000001001001',
  '100000001000000000000001',
  '100000001000200000000001',
  '111010011111010011110001',
  '100000000000000000000001',
  '100011100000011100000001',
  '100010000200010000000001',
  '100010000000010001100001',
  '100000000000000001100001',
  '100000000000000000000001',
  '100001111200011110000001',
  '100001000000010000000001',
  '100001000010010000000001',
  '100000000010000000001001',
  '100011000010000110001001',
  '100010000010000100001001',
  '100010001110000100000001',
  '100000000100000000000001',
  '100100000100001000100001',
  '100000000000000000000001',
  '111111111111111111111111',
] as const;

export function buildMap(): RaycastMap {
  const height = MAP_DATA.length;
  const width = MAP_DATA[0].length;
  const cells = new Uint8Array(width * height);
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const ch = MAP_DATA[z][x];
      cells[z * width + x] = ch === '1' ? 1 : ch === '2' ? 2 : ch === '3' ? 3 : 0;
    }
  }
  return { width, height, cells };
}

export function collectDoors(map: RaycastMap): DoorState[] {
  const doors: DoorState[] = [];
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      if (map.cells[z * map.width + x] === 2) {
        doors.push({ cellX: x, cellZ: z, open: false, progress: 0, cooldown: 0 });
      }
    }
  }
  return doors;
}

let _enemyId = 0;
let _pickupId = 0;

export function createEnemies(): EnemyState[] {
  return [
    { id: _enemyId++, x: 3.5, z: 3.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
    { id: _enemyId++, x: 10.5, z: 2.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
    { id: _enemyId++, x: 5.5, z: 9.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
    { id: _enemyId++, x: 18.5, z: 5.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
    { id: _enemyId++, x: 14.5, z: 14.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
    { id: _enemyId++, x: 8.5, z: 18.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
    { id: _enemyId++, x: 20.5, z: 20.5, health: 100, maxHealth: 100, state: 'idle', alertTimer: 0, waypointIdx: 0, waypointTimer: 0, shootCooldown: 0 },
  ];
}

export function createPickups(): PickupState[] {
  return [
    { id: _pickupId++, x: 6.5, z: 4.5, type: 'ammo', collected: false },
    { id: _pickupId++, x: 12.5, z: 8.5, type: 'health', collected: false },
    { id: _pickupId++, x: 16.5, z: 12.5, type: 'ammo', collected: false },
    { id: _pickupId++, x: 3.5, z: 18.5, type: 'health', collected: false },
    { id: _pickupId++, x: 20.5, z: 10.5, type: 'ammo', collected: false },
  ];
}
