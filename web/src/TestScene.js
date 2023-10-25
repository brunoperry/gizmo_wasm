import Resources from "./Resources.js";
import Scene from "./Scene.js";
import { vec3 } from "./math.js";

export default class TestScene extends Scene {
  #obj;
  #obj2;
  #obj3;
  constructor() {
    super("surfer");

    this.#obj = Resources.get_object("city01");
    this.#obj2 = Resources.get_object("city01");
    this.#obj3 = Resources.get_object("city01");

    this.add_obj3d(this.#obj);
    this.add_obj3d(this.#obj2);
    this.add_obj3d(this.#obj3);

    this.#obj2.position = vec3(0, 2, 0);
    this.#obj2.rotation = vec3(0, 90, 0);

    this.#obj3.position = vec3(0, 1, 0);
    this.#obj3.rotation = vec3(0, -90, 0);

    this.camera.position = vec3(0, 0, -5);
  }

  update(delta) {
    const yRot = (this.#obj.rotation.y += delta);
    // this.#obj.rotation = vec3(0, yRot, 0);

    // this.#obj.rotate(delta);
    super.update(delta);
  }
}
