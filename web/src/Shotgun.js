import { vec3 } from "./math.js";
import Resources from "./Resources.js";
import WASM from "./WASM.js";

export default class Shotgun {
  obj3d;
  constructor() {
    this.obj3d = Resources.get_object("triangle");
    WASM.set_object_buffer(this.obj3d);
  }

  update(pos = vec3(), rot = vec3()) {
    console.log(pos);
    this.position = vec3(pos.x, pos.y - 0.5, pos.z);
    this.rotation = rot;
  }

  set position(pos) {
    this.obj3d.position = pos;
  }
  get position() {
    return this.obj3d.position;
  }

  set rotation(rot) {
    this.obj3d.rotation = rot;
  }
  get rotation() {
    return this.obj3d.rotation;
  }
}
