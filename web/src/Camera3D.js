import Display from "./Display.js";
import WASM from "./WASM.js";
import {
  mat4_from_rotation,
  vec3,
  vec3_cross,
  vec3_scale_and_add,
  vec3_transform_mat4,
} from "./math.js";
import InputController from "./InputController.js";
export default class Camera3D {
  #MOVEMENT_SPEED = 6; // units per second
  #ROTATE_SPEED = 0.002; // radians per mouse pixel
  #MAX_PITCH_Y = 0.99; // |direction.y| limit, avoids flipping over the poles
  #UP = vec3(0, 1, 0);
  #cam_buffer;

  #pos;
  #dir;
  #up;

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
    this.#mouseUpdate();
    this.#checkInputs(delta);
  }
  #mouseUpdate() {
    const { dx, dy } = InputController.consumeMouseDelta();
    if (dx === 0 && dy === 0) return;

    // Yaw: mouse right turns right.
    const rotateY = mat4_from_rotation(-dx * this.#ROTATE_SPEED, this.#UP);
    let dir = vec3_transform_mat4(this.#dir, rotateY);

    // Pitch: mouse down looks down. Skipped near straight up/down.
    const right = vec3_cross(dir, this.#UP);
    const rotateX = mat4_from_rotation(-dy * this.#ROTATE_SPEED, right);
    const pitched = rotateX && vec3_transform_mat4(dir, rotateX);
    if (pitched && Math.abs(pitched.y) < this.#MAX_PITCH_Y) dir = pitched;

    this.direction = dir;
  }
  #checkInputs(delta) {
    const step = this.#MOVEMENT_SPEED * delta;
    const right = vec3_cross(this.#dir, this.#UP);

    if (InputController.getKey(InputController.Key.W)) {
      this.position = vec3_scale_and_add(this.#pos, this.#dir, step);
    } else if (InputController.getKey(InputController.Key.S)) {
      this.position = vec3_scale_and_add(this.#pos, this.#dir, -step);
    }

    if (InputController.getKey(InputController.Key.A)) {
      this.position = vec3_scale_and_add(this.#pos, right, -step);
    } else if (InputController.getKey(InputController.Key.D)) {
      this.position = vec3_scale_and_add(this.#pos, right, step);
    }
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
  set direction(val) {
    this.#dir = val;
    new Float32Array(WASM.mem, this.#cam_buffer[7], 3).set([val.x, val.y, val.z]);
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
