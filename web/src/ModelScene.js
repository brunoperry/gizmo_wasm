import Light3D from "./Light3D.js";
import Scene from "./Scene.js";
import { vec3 } from "./math.js";

// A scene that just shows a model (from the Scene > Models list or a file):
// the default light, and the camera framing everything from the front, a
// little from above.
export default class ModelScene extends Scene {
  #light;
  constructor(name, objects) {
    super(name);
    for (const obj of objects) this.add_obj3d(obj);

    this.#light = new Light3D({
      type: Light3D.Types.POINT,
      position: vec3(-4, 1, -3),
      color: "#ff8833",
      intensity: 1.4,
      range: 9, // fades to zero at this distance
    });
    this.add_light(this.#light);

    this.camera.direction = vec3(0, -0.35, -1);
    this.camera.frame_all(true);
  }
}
