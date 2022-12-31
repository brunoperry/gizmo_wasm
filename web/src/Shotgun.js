import { vec3 } from "./math.js";
import Resources from "./Resources.js";
import WASM from "./WASM.js";

export default class Shotgun {
  mesh;
  constructor() {
    this.mesh = Resources.get_object("shotgun");
    WASM.set_object_buffer(this.mesh);
  }

  update(pos = vec3(), rot = vec3()) {
    this.position = vec3(pos.x, pos.y - 0.5, pos.z);
    this.rotation = rot;
  }

  set position(val) {
    this.mesh.position = val;
  }
  get position() {
    return this.mesh.position;
  }
}
