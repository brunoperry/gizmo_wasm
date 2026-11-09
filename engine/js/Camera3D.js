import Display from "./Display.js";
import WASM from "./WASM.js";
import { vec3, vec3_cross, smooth } from "./math.js";

// The scene's camera: where it is, where it looks, and its lens. It doesn't
// read any input: attach controls to the scene for that (see FlyControls).
export default class Camera3D {
  // Pitch limit, in radians (~86 degrees): avoids flipping over the poles.
  static MAX_PITCH = 1.5;
  #UP = vec3(0, 1, 0);
  #cam_buffer;

  frame_smoothing = 0.08; // seconds: glide to the "frame all" position (0 = jump)
  frame_margin = 1.1; // > 1 leaves some room around the framed objects

  #pos;
  #dir;
  #up;

  // Orientation as angles (the direction is derived from them).
  #yaw = 0;
  #pitch = 0;
  #frame_target = null; // where "frame all" is taking the camera

  constructor(pos = vec3(0, 0, 0), dir = vec3(0, 0, 1.0), up = vec3(0, 1, 0)) {
    this.#pos = pos;
    this.#dir = dir;
    this.#up = up;
  }

  initialize(buffers) {
    this.#cam_buffer = [...buffers];

    this.aspect_x = Display.width / Display.height;
    this.aspect_y = Display.height / Display.width;

    this.fov_x = 60;
    this.fov_y = 60;

    this.z_near = 0.01;
    this.z_far = 100;

    this.position = this.#pos;
    this.direction = this.#dir;

    this.up = this.#up;
  }

  // Called by the scene every frame (after its controls): glides towards
  // the "frame all" position, if there is one.
  update(delta) {
    if (!this.#frame_target) return;
    const t = this.#frame_target, p = this.#pos;
    const next = vec3(
      smooth(p.x, t.x, this.frame_smoothing, delta),
      smooth(p.y, t.y, this.frame_smoothing, delta),
      smooth(p.z, t.z, this.frame_smoothing, delta),
    );
    if (Math.hypot(t.x - next.x, t.y - next.y, t.z - next.z) < 1e-3) {
      this.position = t;
      this.#frame_target = null;
    } else this.position = next;
  }

  // Moves the camera back along its view direction until every object fits
  // in the frustum (like "frame all" in Maya). The view direction is kept.
  // It glides there (see update), or jumps when `immediate`.
  frame_all(immediate = false) {
    const bounds = WASM.scene_bounds();
    if (!bounds) return;
    const { min, max } = bounds;
    const c = vec3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);

    // Camera basis: forward, right, up.
    const f = this.#dir;
    const r = vec3_cross(f, this.#UP);
    const r_len = Math.hypot(r.x, r.y, r.z) || 1;
    ((r.x /= r_len), (r.y /= r_len), (r.z /= r_len));
    const u = vec3_cross(r, f);

    // Each box corner, relative to the centre, seen from a camera at
    // c - f * d, must satisfy |x| <= (d + z) * tan(fov / 2), same for y.
    const tan_x = Math.tan(this.fov_x / 2) / this.frame_margin;
    const tan_y = Math.tan(this.fov_y / 2) / this.frame_margin;
    let d = 0, reach = 0;
    for (let k = 0; k < 8; k++) {
      const px = (k & 1 ? max[0] : min[0]) - c.x;
      const py = (k & 2 ? max[1] : min[1]) - c.y;
      const pz = (k & 4 ? max[2] : min[2]) - c.z;
      const x = px * r.x + py * r.y + pz * r.z;
      const y = px * u.x + py * u.y + pz * u.z;
      const z = px * f.x + py * f.y + pz * f.z;
      d = Math.max(d, Math.abs(x) / tan_x - z, Math.abs(y) / tan_y - z, this.z_near - z);
      reach = Math.max(reach, Math.hypot(px, py, pz));
    }
    // Keep the far side of the scene inside the far plane.
    if (d + reach > this.z_far) this.z_far = (d + reach) * 1.1;

    this.#frame_target = vec3(c.x - f.x * d, c.y - f.y * d, c.z - f.z * d);
    if (immediate) {
      this.position = this.#frame_target;
      this.#frame_target = null;
    }
  }
  // Whether a "frame all" glide is under way.
  get framing() {
    return this.#frame_target !== null;
  }
  cancel_framing() {
    this.#frame_target = null;
  }

  // Orientation in radians: yaw turns around the up axis (0 looks down +z),
  // pitch looks up (positive) or down, clamped to MAX_PITCH.
  get yaw() {
    return this.#yaw;
  }
  get pitch() {
    return this.#pitch;
  }
  set_angles(yaw, pitch) {
    this.#yaw = yaw;
    this.#pitch = Math.max(-Camera3D.MAX_PITCH, Math.min(Camera3D.MAX_PITCH, pitch));
    this.#write_direction();
  }

  #write_direction() {
    const cp = Math.cos(this.#pitch);
    this.#dir = vec3(
      Math.sin(this.#yaw) * cp,
      Math.sin(this.#pitch),
      Math.cos(this.#yaw) * cp,
    );
    new Float32Array(WASM.mem, this.#cam_buffer[7], 3).set([
      this.#dir.x,
      this.#dir.y,
      this.#dir.z,
    ]);
  }

  get position() {
    return this.#pos;
  }
  set position(val) {
    this.#pos = val;
    new Float32Array(WASM.mem, this.#cam_buffer[6], 3).set([val.x, val.y, val.z]);
  }
  // Orientation as Euler angles in degrees, like Object3D.rotation: x = tilt
  // (positive looks down), y = turn around the up axis, z = roll (always 0).
  get rotation() {
    const deg = 180 / Math.PI;
    const yaw = (((this.#yaw * deg + 180) % 360) + 360) % 360 - 180; // -180..180
    return vec3(-this.#pitch * deg, yaw, 0);
  }
  get direction() {
    return this.#dir;
  }
  // Points the camera that way at once (controls follow from there).
  set direction(val) {
    const len = Math.hypot(val.x, val.y, val.z) || 1;
    this.set_angles(Math.atan2(val.x, val.z), Math.asin(Math.max(-1, Math.min(1, val.y / len))));
  }

  get aspect_x() {
    return new Float32Array(WASM.mem, this.#cam_buffer[0], 1)[0];
  }
  set aspect_x(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[0], 1).set([val]);
  }
  get aspect_y() {
    return new Float32Array(WASM.mem, this.#cam_buffer[1], 1)[0];
  }
  set aspect_y(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[1], 1).set([val]);
  }
  set fov(val) {
    this.fov_x = val;
    this.fov_y = val;
  }
  get fov() {
    return this.fov_x;
  }
  get fov_x() {
    return new Float32Array(WASM.mem, this.#cam_buffer[2], 1)[0];
  }
  set fov_x(val) {
    const fov_y = val * (Math.PI / 180);
    const fov_x = Math.atan(Math.tan(fov_y / 2) * this.aspect_x) * 2;
    new Float32Array(WASM.mem, this.#cam_buffer[2], 1).set([fov_x]);
  }
  get fov_y() {
    return new Float32Array(WASM.mem, this.#cam_buffer[3], 1)[0];
  }
  set fov_y(val) {
    const fov_y = val * (Math.PI / 180);
    new Float32Array(WASM.mem, this.#cam_buffer[3], 1).set([fov_y]);
  }
  get z_near() {
    return new Float32Array(WASM.mem, this.#cam_buffer[4], 1)[0];
  }
  set z_near(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[4], 1).set([val]);
  }
  get z_far() {
    return new Float32Array(WASM.mem, this.#cam_buffer[5], 1)[0];
  }
  set z_far(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[5], 1).set([val]);
  }
  get up() {
    return this.#up;
  }
  set up(val) {
    this.#up = val;
    new Float32Array(WASM.mem, this.#cam_buffer[8], 3).set([val.x, val.y, val.z]);
  }
}
