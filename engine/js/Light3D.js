import { vec3 } from "./math.js";
import WASM from "./WASM.js";

// A light in the scene. Add it with scene.add_light(light); every property
// can be changed at any time and takes effect on the next frame.
//
//   new Light3D({ type: Light3D.Types.POINT, position: vec3(0, 3, 0), color: "#ffaa55", range: 10 })
//
// Options (all optional):
//   type         DIRECTIONAL (default), POINT or SPOT
//   color        "#rrggbb", or { r, g, b } / [r, g, b] with 0..1 values
//   intensity    multiplies color (default 1)
//   position     POINT / SPOT position; for DIRECTIONAL only where its gizmo is drawn
//   direction    DIRECTIONAL / SPOT: the way the light travels (doesn't need to be normalized)
//   range        POINT / SPOT: distance where the light fades to zero (0 = no falloff)
//   inner_angle  SPOT: full brightness inside this angle from the axis (degrees)
//   outer_angle  SPOT: no light outside this angle; smooth in between
//   shadows      casts shadows when shadows are on (default true)
//   shadow_distance  DIRECTIONAL: 0 (default) = the shadow map holds the whole
//                scene; in a big world that leaves it too coarse, so give the
//                view depth that gets shadows: the map then follows the camera
export default class Light3D {
  static Types = { DIRECTIONAL: 0, POINT: 1, SPOT: 2 };
  static MAX_LIGHTS = 8; // keep in sync with MAX_LIGHTS in C/light3d.h
  static STRIDE = 16; // floats per light, see C/light3d.h

  #pointer = 0; // this light's slot in wasm memory, 0 while not in a scene
  #type;
  #color;
  #intensity;
  #position;
  #direction;
  #range;
  #inner_angle;
  #outer_angle;
  #shadows;
  #shadow_distance;

  constructor({
    type = Light3D.Types.DIRECTIONAL,
    color = "#ffffff",
    intensity = 1,
    position = vec3(0, 5, 0),
    direction = vec3(-1, -1, -1),
    range = 10,
    inner_angle = 20,
    outer_angle = 30,
    shadows = true,
    shadow_distance = 0,
  } = {}) {
    this.#type = type;
    this.#color = Light3D.parse_color(color);
    this.#intensity = intensity;
    this.#position = position;
    this.#direction = direction;
    this.#range = range;
    this.#inner_angle = inner_angle;
    this.#outer_angle = outer_angle;
    this.#shadows = shadows;
    this.#shadow_distance = shadow_distance;
  }

  // Called by Scene when the light is added (pointer) or removed (0).
  attach(pointer) {
    this.#pointer = pointer;
    this.#write();
  }

  #write() {
    if (!this.#pointer) return;
    const to_cos = (deg) => Math.cos((Math.min(Math.max(deg, 0), 89) * Math.PI) / 180);
    const outer = Math.max(this.#outer_angle, this.#inner_angle);
    new Float32Array(WASM.mem, this.#pointer, Light3D.STRIDE).set([
      this.#type,
      this.#intensity,
      this.#range,
      to_cos(this.#inner_angle),
      to_cos(outer),
      this.#color.r,
      this.#color.g,
      this.#color.b,
      this.#position.x,
      this.#position.y,
      this.#position.z,
      this.#direction.x,
      this.#direction.y,
      this.#direction.z,
      this.#shadows ? 1 : 0,
      this.#shadow_distance,
    ]);
  }

  // "#rrggbb" / "#rgb", { r, g, b } or [r, g, b] (0..1) -> { r, g, b }
  static parse_color(color) {
    if (Array.isArray(color)) return { r: color[0], g: color[1], b: color[2] };
    if (typeof color === "object" && color) return { r: color.r, g: color.g, b: color.b };
    let hex = String(color).replace("#", "");
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
    const value = parseInt(hex, 16);
    if (hex.length !== 6 || Number.isNaN(value)) throw new Error(`Invalid color "${color}"`);
    return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
  }

  get type() {
    return this.#type;
  }
  set type(val) {
    this.#type = val;
    this.#write();
  }
  get color() {
    return this.#color;
  }
  set color(val) {
    this.#color = Light3D.parse_color(val);
    this.#write();
  }
  get intensity() {
    return this.#intensity;
  }
  set intensity(val) {
    this.#intensity = val;
    this.#write();
  }
  get position() {
    return this.#position;
  }
  set position(val) {
    this.#position = val;
    this.#write();
  }
  get direction() {
    return this.#direction;
  }
  set direction(val) {
    this.#direction = val;
    this.#write();
  }
  get range() {
    return this.#range;
  }
  set range(val) {
    this.#range = val;
    this.#write();
  }
  get inner_angle() {
    return this.#inner_angle;
  }
  set inner_angle(val) {
    this.#inner_angle = val;
    this.#write();
  }
  get shadows() {
    return this.#shadows;
  }
  set shadows(val) {
    this.#shadows = val;
    this.#write();
  }
  get shadow_distance() {
    return this.#shadow_distance;
  }
  set shadow_distance(val) {
    this.#shadow_distance = val;
    this.#write();
  }
  get outer_angle() {
    return this.#outer_angle;
  }
  set outer_angle(val) {
    this.#outer_angle = val;
    this.#write();
  }
}
