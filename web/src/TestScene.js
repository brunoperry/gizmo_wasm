import Resources from './Resources.js';
import Scene from './Scene.js';
import { vec3 } from './math.js';

export default class TestScene extends Scene {
  #obj;
  constructor() {
    super('test');

    this.#obj = Resources.get_object('bowl');

    this.add_obj3d(this.#obj);
  }

  update(delta) {

    const yRot = this.#obj.rotation.y += delta;
    this.#obj.rotation = vec3(0,yRot,0);

    // this.#obj.rotate(delta);
    super.update(delta);
  }
}
