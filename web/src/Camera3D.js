import { vec3 } from "./math.js";
import Camera from "./Camera.js";

export default class Camera3D extends Camera {
  constructor(pos = vec3(0, 0, 0), dir = vec3(0, 0, 1.0), up = vec3(0, 1, 0)) {
    super(vec3(0, 2, 0));
  }

  update() {}
}
