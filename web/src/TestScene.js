import Resources from "./Resources.js";
import Scene from "./Scene.js";
import { vec3 } from "./math.js";

export default class TestScene extends Scene {
  #obj;
  #obj2;
  constructor() {
    super("surfer");

    this.#obj = Resources.get_object("bowl");
    this.#obj2 = Resources.get_object("surfer");

    this.add_obj3d(this.#obj2);
    this.add_obj3d(this.#obj);

    this.#obj2.position = vec3(0, -6, 16);
    this.camera.position = vec3(0, 0, -30);
    // this.camera.direction = vec3(
    //   0.8430399624045004,
    //   0.17509277691431607,
    //   0.5085529876634602
    // );
  }

  update(delta) {
    const yRot = (this.#obj.rotation.y += delta);
    this.#obj.rotation = vec3(0, yRot, 0);

    console.log(delta);

    // this.#obj.rotate(delta);
    super.update(delta);
  }
}
