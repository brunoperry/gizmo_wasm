import Resources from "./Resources.js";
import Scene from "./Scene.js";
import { vec3 } from "./math.js";

export default class TestScene extends Scene {
  #obj;
  #obj2;
  constructor() {
    super("surfer");

    this.#obj = Resources.get_object("surfer");
    this.#obj2 = Resources.get_object("bowl");


    this.add_obj3d(this.#obj);
    this.add_obj3d(this.#obj2);

    this.#obj2.position = vec3(0, 3, 0);

    this.camera.position = vec3(0, 0, -15);
  }

  update(delta) {
    const yRot = (this.#obj.rotation.y += delta + 1);
    this.#obj.rotation = vec3(0, yRot, 0);

    super.update(delta);
  }
}
