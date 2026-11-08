import WASM from "./WASM.js";
import Light3D from "./Light3D.js";
import Camera3D from "./Camera3D.js";
import { vec3 } from "./math.js";

const LIGHT_HEADER = 4; // count, ambient r, g, b (see C/light3d.h)

export default class Scene {
  objects_3d = [];
  lights = [];
  animators = new Set(); // advanced every frame
  player;
  light; // the default directional light
  camera;
  name;

  #lights_pointer;
  #ambient = Light3D.parse_color([0.3, 0.3, 0.3]);

  constructor(name = "unnamed") {
    this.name = name;
    this.camera = new Camera3D();
    this.set_camera(this.camera);

    this.#lights_pointer = WASM.set_light_buffer();
    this.ambient = this.#ambient;
    // Same look as the engine's original single light: 0.3 ambient + 0.7 directional.
    this.light = new Light3D({ direction: vec3(-1, -1, -1), intensity: 0.7 });
    this.add_light(this.light);
  }

  add_obj3d(obj3d) {
    this.objects_3d.push(obj3d);
    if (obj3d.animation) this.animators.add(obj3d.animation);

    WASM.set_object_buffer(obj3d);
  }
  set_camera(camera) {
    WASM.set_camera_buffer(camera);
  }

  add_light(light) {
    if (this.lights.includes(light)) return light;
    if (this.lights.length >= Light3D.MAX_LIGHTS) {
      throw new Error(`A scene can have at most ${Light3D.MAX_LIGHTS} lights`);
    }
    this.lights.push(light);
    this.#sync_lights();
    return light;
  }
  remove_light(light) {
    const index = this.lights.indexOf(light);
    if (index < 0) return;
    this.lights.splice(index, 1);
    light.attach(0);
    this.#sync_lights();
  }
  // Lights fill the first slots in order.
  #sync_lights() {
    new Float32Array(WASM.mem, this.#lights_pointer, 1)[0] = this.lights.length;
    this.lights.forEach((light, i) => {
      light.attach(this.#lights_pointer + (LIGHT_HEADER + i * Light3D.STRIDE) * Float32Array.BYTES_PER_ELEMENT);
    });
  }

  // Light every surface gets, even facing away from all lights.
  // "#rrggbb", { r, g, b } or [r, g, b] (0..1).
  get ambient() {
    return this.#ambient;
  }
  set ambient(color) {
    this.#ambient = Light3D.parse_color(color);
    new Float32Array(WASM.mem, this.#lights_pointer + 4, 3).set([this.#ambient.r, this.#ambient.g, this.#ambient.b]);
  }

  update(delta) {
    for (const animator of this.animators) animator.update(delta);
    this.camera.update(delta);
  }
}
