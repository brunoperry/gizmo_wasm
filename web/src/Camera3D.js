import Display from "./Display.js";
import Transform from "./Transform.js";
import WASM from "./WASM.js";
import {
  vec3,
  mat4_make_perspective,
  mat4_mul_mat4,
  mat4_to_buffer,
  mat4_make_translation,
  vec3_normalize,
  vec3_sub,
  vec3_cross,
  vec3_scale,
  mat4_identity,
  mat4_make_view,
} from "./math.js";

export default class Camera3D {
  static BUFFER_SIZE = 2;

  #projection_buffer;
  #view_buffer;
  #transform;
  #FOV;

  constructor(position = vec3(), target = vec3(0, 0, 20), up = vec3(0, 1, 0)) {
    this.#transform = new Transform();

    this.fov = 60;
    this.position = position;
    this.up = up;
    this.target = target;
    // this.rotation = rotation;

    this.near = 0.01;
    this.far = 1000;
  }

  initialize(buffers) {
    this.#view_buffer = buffers[0];
    this.#projection_buffer = buffers[1];
    this.update();
  }

  update() {
    this.#updateViewMatrix();
    this.#updateProjectionMatrix();
  }

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
