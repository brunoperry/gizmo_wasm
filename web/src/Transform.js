import { vec3 } from "./math.js";

export default class Transform {
  #pos;
  #rot;
  #scl;

  constructor(pos = vec3(), rot = vec3(), scl = vec3(1, 1, 1)) {
    this.#pos = pos;
    this.#rot = rot;
    this.#scl = scl;
  }

  initialize() {
    this.position = this.#pos;
    this.rotation = this.#rot;
    this.scale = this.#scl;
  }

  get position() {
    return this.#pos;
  }
  set position(pos) {
    this.#pos = pos;
  }
  get rotation() {
    return this.#rot;
  }
  set rotation(rot) {
    this.#rot = rot;
  }
  get scale() {
    return this.#scl;
  }
  set scale(scl) {
    this.#scl = scl;
  }
}
