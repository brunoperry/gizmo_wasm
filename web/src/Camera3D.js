import Display from "./Display.js";
import InputController from "./InputController.js";
import Transform from "./Transform.js";
import WASM from "./WASM.js";
import {
  vec3,
  mat4_make_perspective,
  mat4_to_buffer,
  mat4_make_view,
  vec3_to_buffer,
} from "./math.js";

export default class Camera3D {
  static BUFFER_SIZE = 3;

  #projection_buffer;
  #view_buffer;
  #position_buffer;
  #transform;
  #FOV;

  constructor(position = vec3(), target = vec3(0, 0, 1), up = vec3(0, 1, 0)) {
    this.#transform = new Transform();

    this.fov = 60;
    this.position = position;
    this.up = up;
    this.target = target;

    this.near = 0.1;
    this.far = 1000;
  }

  initialize(buffers) {
    this.#view_buffer = buffers[0];
    this.#projection_buffer = buffers[1];
    this.#position_buffer = buffers[2];

    this.update();
  }

  update() {
    this.#updateViewMatrix();
    this.#updateProjectionMatrix();
  }

  /**
   * DEBUG
   */
  #updateProjectionMatrix() {
    const projectionMatrix = mat4_make_perspective(
      this.fov,
      Display.width / Display.height,
      this.near,
      this.far
    );
    new Float32Array(WASM.mem, this.#projection_buffer, 16).set(
      mat4_to_buffer(projectionMatrix)
    );
  }
  #updateViewMatrix() {
    const viewMatrix = mat4_make_view(this.position, this.target, this.up);
    new Float32Array(WASM.mem, this.#view_buffer, 16).set(mat4_to_buffer(viewMatrix));
  }

  get position() {
    return this.#transform.position;
  }
  set position(vec) {
    new Float32Array(WASM.mem, this.#position_buffer, 3).set(vec3_to_buffer(vec));
    this.#transform.position = vec;
  }

  get rotation() {
    return this.#transform.rotation;
  }
  set rotation(vec) {
    this.#transform.rotation = vec;
  }

  get scale() {
    return this.#transform.scale;
  }
  set scale(vec) {
    this.#transform.scale = vec;
  }

  get fov() {
    return this.#FOV * (Math.PI / 180);
  }
  set fov(val) {
    this.#FOV = val;
  }

  get view_matrix() {
    return mat4_make_view(this.position, this.target, this.up);
  }
  get projection_matrix() {
    return mat4_make_perspective(
      this.fov,
      Display.width / Display.height,
      this.near,
      this.far
    );
  }
}
