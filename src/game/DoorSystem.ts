import type { DoorState } from './World.ts';
import type { RaycastMap } from '../engine/Raycaster.ts';

const DOOR_SPEED = 2.5;
const AUTO_CLOSE_DELAY = 4;

export class DoorSystem {
  update(dt: number, doors: DoorState[], map: RaycastMap): void {
    for (const door of doors) {
      if (door.open) {
        door.progress = Math.min(1, door.progress + DOOR_SPEED * dt);
        if (door.progress >= 1) {
          map.cells[door.cellZ * map.width + door.cellX] = 0;
          door.cooldown += dt;
          if (door.cooldown >= AUTO_CLOSE_DELAY) { door.open = false; door.cooldown = 0; }
        }
      } else {
        door.cooldown = 0;
        door.progress = Math.max(0, door.progress - DOOR_SPEED * dt);
        if (door.progress <= 0) { map.cells[door.cellZ * map.width + door.cellX] = 2; }
      }
    }
  }
}
