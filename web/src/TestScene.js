import Resources from './Resources.js';
import Scene from './Scene.js';
import { vec3 } from './math.js';

export default class TestScene extends Scene {
  #obj;
  constructor() {
    super('surfer');

    this.#obj = Resources.get_object('surfer');

    this.add_obj3d(this.#obj);

    this.camera.position = vec3(-7.482987053782568, -0.3860208457046338, -4.445848639506135 );
    this.camera.direction = vec3(0.8430399624045004,  0.17509277691431607, 0.5085529876634602);
  }

  update(delta) {

    const yRot = this.#obj.rotation.y += delta;
    this.#obj.rotation = vec3(0,yRot,0);

    // this.#obj.rotate(delta);
    super.update(delta);
  }
}
