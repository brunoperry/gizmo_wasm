import Resources from './Resources.js';
import Scene from './Scene.js';

export default class MarginalScene extends Scene {
  #obj;
  constructor() {
    super('marginal');

    this.#obj = Resources.get_object('marginal2');
    this.add_obj3d(this.#obj);
  }

  update(delta) {
    super.update(delta);
  }
}
