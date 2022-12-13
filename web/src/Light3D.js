import { vec3 } from "./math.js";
import WASM from "./WASM.js";

export default class Light3D {
  #dir_buffer;
  #dir;
  constructor(direction = vec3(-1, -1, 1)) {
    this.#dir = direction;
  }
  initialize(buffers) {
    this.#dir_buffer = buffers[0];

    this.direction = this.#dir;
  }

  get direction() {
    return this.#dir;
  }
  set direction(val) {
    this.#dir = val;

    new Float32Array(WASM.mem, this.#dir_buffer, 3).set([val.x, val.y, val.z]);
  }
}
