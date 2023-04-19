import Mesh from "./Mesh.js";
import Transform from "./Transform.js";
import WASM from "./WASM.js";
import { mat4_make_model, mat4_to_buffer } from "./math.js";

export default class Object3D {
  static BUFFER_SIZE = 5;
  #data;
  #mesh;
  #transform;

  #model_buffer;
  constructor(data) {
    this.#data = data;
    this.#mesh = new Mesh(data);
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
    const modelMatrix = mat4_make_model(this.#transform);
    new Float32Array(WASM.mem, this.#model_buffer, 16).set(mat4_to_buffer(modelMatrix));
  }

  get model_matrix() {
    return mat4_make_model(this.#transform);
  }
}
