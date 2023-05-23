import WASM from "./WASM.js";
import Light3D from "./Light3D.js";
import Player from "./Player.js";

export default class Scene {
  objects_3d = [];
  player;
  light;
  name;
  constructor(name = "unnamed") {
    this.name = name;
    this.light = new Light3D();

    this.player = new Player();

    this.set_light(this.light);
    this.set_camera(this.player);
  }

  add_obj3d(obj3d) {
    this.objects_3d.push(obj3d);

    WASM.set_object_buffer(obj3d);
  }
  set_camera(camera) {
    WASM.set_camera_buffer(camera);
  }
  set_light(light) {
    WASM.set_light_buffer(light);
  }

  update() {
    this.player.update();
  }
}
