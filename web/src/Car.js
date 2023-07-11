import Resources from './Resources.js';
import WASM from './WASM.js';

export default class Car {
  obj3d;
  constructor(type = 'visa') {
    this.obj3d = Resources.get_object(type);
    WASM.set_object_buffer(this.obj3d);
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
