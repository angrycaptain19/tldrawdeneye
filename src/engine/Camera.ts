export class Camera {
  x = 0; y = 0.5; z = 0;
  yaw = 0; pitch = 0;
  private static readonly PITCH_LIMIT = (85 * Math.PI) / 180;
  sensitivity = 0.002;

  applyMouseDelta(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch = Math.max(-Camera.PITCH_LIMIT, Math.min(Camera.PITCH_LIMIT, this.pitch));
  }

  get forwardXZ(): { x: number; z: number } {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  get rightXZ(): { x: number; z: number } {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }
}
