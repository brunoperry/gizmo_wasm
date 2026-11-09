import Camera3D from "./Camera3D.js";
import InputController from "./InputController.js";
import { vec3, vec3_cross, smooth } from "./math.js";

// Free-fly camera controls, as in a 3D editor: the mouse looks around (with
// the pointer locked, see the engine's pointer_lock option), W A S D move,
// F frames everything (Camera3D.frame_all). Everything is smoothed.
// Use: scene.controls = new FlyControls(scene.camera);
export default class FlyControls {
  speed = 6; // units per second
  rotate_speed = 0.002; // radians per mouse pixel
  // Smoothing time constants, in seconds (0 = off). Bigger = softer.
  look_smoothing = 0.04; // mouse look
  move_smoothing = 0.12; // acceleration / braking

  #camera;
  #UP = vec3(0, 1, 0);
  // The mouse moves the target angles, the camera follows them.
  #target_yaw = 0;
  #target_pitch = 0;
  #written = null; // [yaw, pitch] last given to the camera
  #velocity = vec3(0, 0, 0);
  #frame_key_down = false;

  constructor(camera) {
    this.#camera = camera;
  }
  get camera() {
    return this.#camera;
  }

  // Called by the scene every frame, before camera.update.
  update(delta) {
    const camera = this.#camera;
    // Someone else turned the camera (e.g. camera.direction = ...): start from there.
    if (!this.#written || this.#written[0] !== camera.yaw || this.#written[1] !== camera.pitch) {
      this.#target_yaw = camera.yaw;
      this.#target_pitch = camera.pitch;
      this.#written = [camera.yaw, camera.pitch];
    }
    this.#look(delta);

    // F frames everything, once per key press.
    const frame_key = !!InputController.getKey(InputController.Key.F);
    if (frame_key && !this.#frame_key_down) camera.frame_all();
    this.#frame_key_down = frame_key;

    if (camera.framing && !this.#moving()) {
      this.#velocity = vec3(0, 0, 0); // the camera glides there by itself
    } else {
      camera.cancel_framing(); // W A S D take over
      this.#move(delta);
    }
  }

  #look(delta) {
    const camera = this.#camera;
    const { dx, dy } = InputController.consumeMouseDelta();
    // Mouse right turns right, mouse down looks down.
    this.#target_yaw -= dx * this.rotate_speed;
    this.#target_pitch -= dy * this.rotate_speed;
    this.#target_pitch = Math.max(-Camera3D.MAX_PITCH, Math.min(Camera3D.MAX_PITCH, this.#target_pitch));

    const yaw = smooth(camera.yaw, this.#target_yaw, this.look_smoothing, delta);
    const pitch = smooth(camera.pitch, this.#target_pitch, this.look_smoothing, delta);
    if (yaw === camera.yaw && pitch === camera.pitch) return;
    camera.set_angles(yaw, pitch);
    this.#written = [camera.yaw, camera.pitch];
  }

  #moving() {
    const K = InputController.Key;
    return [K.W, K.A, K.S, K.D].some((k) => InputController.getKey(k));
  }

  #move(delta) {
    const camera = this.#camera;
    const dir = camera.direction;
    const key = (k) => (InputController.getKey(k) ? 1 : 0);
    const forward = key(InputController.Key.W) - key(InputController.Key.S);
    const strafe = key(InputController.Key.D) - key(InputController.Key.A);

    // Wanted velocity: same speed in every direction, diagonals included.
    const right = vec3_cross(dir, this.#UP);
    const right_len = Math.hypot(right.x, right.y, right.z) || 1;
    let tx = dir.x * forward + (right.x / right_len) * strafe;
    let ty = dir.y * forward + (right.y / right_len) * strafe;
    let tz = dir.z * forward + (right.z / right_len) * strafe;
    const len = Math.hypot(tx, ty, tz);
    const scale = len > 0 ? this.speed / len : 0;
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
    const p = camera.position;
    camera.position = vec3(p.x + v.x * delta, p.y + v.y * delta, p.z + v.z * delta);
  }
}
