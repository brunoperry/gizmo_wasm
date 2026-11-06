import Light3D from "./Light3D.js";
import Resources from "./Resources.js";
import Scene from "./Scene.js";
import { vec3 } from "./math.js";

export default class TestScene extends Scene {
  static ROTATION_SPEED = 60; // degrees per second
  #obj;
  #obj2;
  #city;
  constructor() {
    super("surfer");

    this.#city = Resources.get_objects("surfer_usd");
    for (const obj of this.#city) this.add_obj3d(obj);

    this.add_light(
      new Light3D({
        type: Light3D.Types.POINT,
        position: vec3(-4, 1, -3),
        color: "#ff8833",
        intensity: 1.4,
        range: 9, // fades to zero at this distance
      }),
    );

    this.camera.position = vec3(0, 0, -20);
  }

  update(delta) {
    const yRot = (this.#city[0].rotation.y + delta * TestScene.ROTATION_SPEED) % 360;
    // for (const obj of this.#city) obj.rotation = vec3(0, yRot, 0);

    super.update(delta);
  }
}
