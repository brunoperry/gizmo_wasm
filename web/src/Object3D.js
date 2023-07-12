import { vec3 } from "./math.js";
import WASM from "./WASM.js";

export default class Object3D {
  #obj_data = null;

  #p_buffer;
  #r_buffer;
  #s_buffer;
  #pos = vec3(0, 0, 0);
  #rot = vec3(0, 0, 0);
  #scl = vec3(1, 1, 1);
  constructor(data) {
    this.#obj_data = data;
  }

  initialize(buffers) {
    new Float32Array(WASM.mem, buffers[0], this.vertices.length).set(this.vertices);
    new Float32Array(WASM.mem, buffers[1], this.uvs.length).set(this.uvs);
    new Float32Array(WASM.mem, buffers[2], this.normals.length).set(this.normals);
    new Uint8ClampedArray(WASM.mem, buffers[6], this.texture.length).set(
      this.texture.data
    );
    this.#p_buffer = buffers[3];
    this.#r_buffer = buffers[4];
    this.#s_buffer = buffers[5];

    this.position = vec3(0, 0, 0);
    this.rotation = vec3(0, 0, 0);
    this.scale = vec3(1, 1, 1);
  }

  get position() {
    return this.#pos;
  }
  set position(vec) {
    this.#pos = vec;

    new Float32Array(WASM.mem, this.#p_buffer, 3).set([vec.x, vec.y, vec.z]);
  }

  get rotation() {
    return this.#rot;
  }
  set rotation(vec) {
    this.#rot = vec;
    new Float32Array(WASM.mem, this.#r_buffer, 3).set([vec.x, vec.y, vec.z]);
  }

  get scale() {
    return this.#scl;
  }
  set scale(vec) {
    this.#scl = vec;
    if (!this.#s_buffer) return;
    new Float32Array(WASM.mem, this.#s_buffer, 3).set([vec.x, vec.y, vec.z]);
  }

  get name() {
    return this.#obj_data.name;
  }
  get vertices() {
    return this.#obj_data.vertices;
  }
  get uvs() {
    return this.#obj_data.uvs;
  }
  get normals() {
    return this.#obj_data.normals;
  }
  get data() {
    return this.#obj_data;
  }
}
