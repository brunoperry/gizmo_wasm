import WASM from "./WASM.js";
import Resources from "./Resources.js";
import Light3D from "./Light3D.js";
import Camera3D from "./Camera3D.js";
import { vec3 } from "./math.js";

const LIGHT_HEADER = 4; // count, ambient r, g, b (see C/light3d.h)

export default class Scene {
  objects_3d = [];
  lights = [];
  animators = new Set(); // advanced every frame
  player;
  light = null; // the default directional light (see the constructor)
  camera;
  controls = null; // moves the camera from the input, e.g. FlyControls (optional)
  name;

  #lights_pointer;
  #ambient = Light3D.parse_color([0.3, 0.3, 0.3]);
  #sky = null;
  #fog = null;

  // default_light: a directional light (0.7, from above-front-right) that,
  // with the 0.3 ambient, lights any model decently. Off for scenes that
  // set up their own lights.
  constructor(name = "unnamed", { default_light = true } = {}) {
    this.name = name;
    this.camera = new Camera3D();
    this.set_camera(this.camera);

    this.#lights_pointer = WASM.set_light_buffer();
    this.ambient = this.#ambient;
    if (default_light) {
      this.light = new Light3D({ direction: vec3(-1, -1, -1), intensity: 0.7 });
      this.add_light(this.light);
    }
  }

  add_obj3d(obj3d) {
    this.objects_3d.push(obj3d);
    if (obj3d.animation) this.animators.add(obj3d.animation);

    // The texture goes into wasm memory with the first object that uses it.
    WASM.set_object_buffer(obj3d, Resources.texture_id(obj3d.texture));
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

  // The background color ("#rrggbb", { r, g, b } or [r, g, b], 0..1), or
  // null for the engine's default (translucent, shows the page behind).
  get sky() {
    return this.#sky;
  }
  set sky(color) {
    this.#sky = color === null ? null : Light3D.parse_color(color);
    this.#write_environment();
  }
  // Distance fog: { near, far } in view depth (world units). Things fade
  // into the sky color from near and are gone at far, so set the camera's
  // z_far to `far` and nothing pops in. null = no fog.
  get fog() {
    return this.#fog;
  }
  set fog(fog) {
    this.#fog = fog ? { near: fog.near, far: fog.far } : null;
    this.#write_environment();
  }
  #write_environment() {
    const byte = (v) => Math.round(Math.min(Math.max(v, 0), 1) * 255);
    const sky = this.#sky
      ? ((255 << 24) | (byte(this.#sky.b) << 16) | (byte(this.#sky.g) << 8) | byte(this.#sky.r)) >>> 0
      : null;
    WASM.set_environment(sky, this.#fog?.near ?? 0, this.#fog?.far ?? 0);
  }

  update(delta) {
    for (const animator of this.animators) animator.update(delta);
    this.controls?.update(delta);
    this.camera.update(delta);
  }
}
