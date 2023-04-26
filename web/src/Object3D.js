import Mesh from "./Mesh.js";
import Resources from "./Resources.js";
import Transform from "./Transform.js";
import WASM from "./WASM.js";
import {
  mat4_from_quat,
  mat4_make_model,
  mat4_make_translation,
  mat4_mul_mat4,
  mat4_to_buffer,
} from "./math.js";

export default class Object3D {
  static BUFFER_SIZE = 5;

  isDynamic = false;
  rigidBody = null;
  #data;
  #mesh;
  #transform;

  #model_buffer;
  constructor(objName) {
    this.#data = Resources.get_object(objName);

    this.#mesh = new Mesh(this.#data);
    this.#transform = new Transform();
  }
  get mesh() {
    return this.#mesh;
  }
  get transform() {
    return this.#transform;
  }
  get name() {
    return this.#data.name;
  }

  initialize(buffers) {
    this.#mesh.initialize(buffers[0], buffers[1], buffers[2]);
    this.#transform.initialize();
    this.#model_buffer = buffers[4];
  }

  update() {
    let modelMatrix;
    if (this.isDynamic) {
      const carPosition = this.rigidBody.position;
      const carOrientation = mat4_from_quat(this.rigidBody.rotation);
      modelMatrix = mat4_mul_mat4(carOrientation, mat4_make_translation(carPosition));
    } else {
      modelMatrix = mat4_make_model(this.#transform);
    }

    new Float32Array(WASM.mem, this.#model_buffer, 16).set(mat4_to_buffer(modelMatrix));
  }

  get model_matrix() {
    return mat4_make_model(this.#transform);
  }
}
