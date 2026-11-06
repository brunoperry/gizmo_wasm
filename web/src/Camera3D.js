import Display from "./Display.js";
import WASM from "./WASM.js";
import { vec3, vec3_cross } from "./math.js";
import InputController from "./InputController.js";

// Smoothly approaches `target`: covers ~63% of the gap every `time_constant`
// seconds, whatever the frame rate. 0 = no smoothing.
const smooth = (current, target, time_constant, delta) =>
  time_constant > 0
    ? current + (target - current) * (1 - Math.exp(-delta / time_constant))
    : target;

export default class Camera3D {
  #MOVEMENT_SPEED = 6; // units per second
  #ROTATE_SPEED = 0.002; // radians per mouse pixel
  #MAX_PITCH = 1.5; // radians (~86 degrees), avoids flipping over the poles
  #UP = vec3(0, 1, 0);
  #cam_buffer;

  // Smoothing time constants, in seconds (0 = off). Bigger = softer.
  look_smoothing = 0.04; // mouse look
  move_smoothing = 0.12; // acceleration / braking

  #pos;
  #dir;
  #up;

  // Orientation as angles: the mouse moves the target, the view follows it.
  #yaw = 0;
  #pitch = 0;
  #target_yaw = 0;
  #target_pitch = 0;
  #velocity = vec3(0, 0, 0);

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

    // this.#pos = vec3(-7.482987053782568, -0.3860208457046338, -4.445848639506135 );
    // this.#dir = vec3(0.8430399624045004,  0.17509277691431607, 0.5085529876634602);

    this.position = this.#pos;
    this.direction = this.#dir;

    this.up = this.#up;
  }

  update(delta) {
    this.#mouseUpdate(delta);
    this.#checkInputs(delta);
  }
  #mouseUpdate(delta) {
    const { dx, dy } = InputController.consumeMouseDelta();
    // Mouse right turns right, mouse down looks down.
    this.#target_yaw -= dx * this.#ROTATE_SPEED;
    this.#target_pitch -= dy * this.#ROTATE_SPEED;
    this.#target_pitch = Math.max(
      -this.#MAX_PITCH,
      Math.min(this.#MAX_PITCH, this.#target_pitch),
    );

    const yaw = smooth(this.#yaw, this.#target_yaw, this.look_smoothing, delta);
    const pitch = smooth(this.#pitch, this.#target_pitch, this.look_smoothing, delta);
    if (yaw === this.#yaw && pitch === this.#pitch) return;
    this.#yaw = yaw;
    this.#pitch = pitch;
    this.#write_direction();
  }
  #checkInputs(delta) {
    const key = (k) => (InputController.getKey(k) ? 1 : 0);
    const forward = key(InputController.Key.W) - key(InputController.Key.S);
    const strafe = key(InputController.Key.D) - key(InputController.Key.A);

    // Wanted velocity: same speed in every direction, diagonals included.
    const right = vec3_cross(this.#dir, this.#UP);
    const right_len = Math.hypot(right.x, right.y, right.z) || 1;
    let tx = this.#dir.x * forward + (right.x / right_len) * strafe;
    let ty = this.#dir.y * forward + (right.y / right_len) * strafe;
    let tz = this.#dir.z * forward + (right.z / right_len) * strafe;
    const len = Math.hypot(tx, ty, tz);
    const scale = len > 0 ? this.#MOVEMENT_SPEED / len : 0;
    ((tx *= scale), (ty *= scale), (tz *= scale));

    // Accelerate / brake towards it instead of jumping.
    const v = this.#velocity;
    v.x = smooth(v.x, tx, this.move_smoothing, delta);
    v.y = smooth(v.y, ty, this.move_smoothing, delta);
    v.z = smooth(v.z, tz, this.move_smoothing, delta);
    if (Math.hypot(v.x, v.y, v.z) < 1e-4 && len === 0) {
      v.x = v.y = v.z = 0;
      return;
    }
    this.position = vec3(
      this.#pos.x + v.x * delta,
      this.#pos.y + v.y * delta,
      this.#pos.z + v.z * delta,
    );
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
  get direction() {
    return this.#dir;
  }
  // Setting the direction (e.g. from a scene) points the camera there at once.
  set direction(val) {
    const len = Math.hypot(val.x, val.y, val.z) || 1;
    this.#yaw = this.#target_yaw = Math.atan2(val.x, val.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, val.y / len)));
    this.#pitch = this.#target_pitch = Math.max(
      -this.#MAX_PITCH,
      Math.min(this.#MAX_PITCH, pitch),
    );
    this.#write_direction();
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
