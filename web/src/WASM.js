import Camera3D from "./Camera3D.js";
import Object3D from "./Object3D.js";
import { vec3, vec4 } from "./math.js";

export default class WASM {
  static #c_module = null;

  constructor(c_module) {
    WASM.#c_module = c_module;
  }

  static wasm_log(a, b) {
    console.log("WASM", `line:${a}, val:${b}`);
  }
  static wasm_info(num_tris, num_vertices) {
    document.dispatchEvent(
      new CustomEvent("wasm_info", {
        detail: { verts: num_vertices, tris: num_tris },
      })
    );
  }
  static log_vec3(vx, vy, vz) {
    console.log("vec3", vec3(vx, vy, vz));
  }
  static log_vec4(vx, vy, vz, vw) {
    console.log("vec4", vec4(vx, vy, vz, vw));
  }
  static log_float(f) {
    console.log("float", f);
  }
  static log_int(i) {
    console.log("int", i);
  }
  static log_matrix(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p) {
    // console.log([a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p]);
    console.table([
      [a, b, c, d],
      [e, f, g, h],
      [i, j, k, l],
      [m, n, o, p],
    ]);
  }
  static log_polygon(num_verts) {
    console.log("polygon verts:", num_verts);
  }
  static log_triangle(ax, ay, az, aw, bx, by, bz, bw, cx, cy, cz, cw) {
    const tri = {
      a: vec4(ax, ay, az, aw),
      b: vec4(bx, by, bz, bw),
      c: vec4(cx, cy, cz, cw),
    };
    console.table(tri);
  }
  static get mem() {
    return WASM.#c_module.memory.buffer;
  }
  static get mem_size() {
    return WASM.#c_module.memory.buffer.byteLength;
  }

  update() {
    WASM.#c_module.update();
  }
  update_once() {
    WASM.#c_module.update_once();
  }

  // static set_color_buffer(width, height) {
  //   return WASM.#c_module.set_color_buffer(width, height);
  // }

  static set_display_buffer(width, height) {
    return WASM.#c_module.set_display_buffer(width, height);
  }
  static set_camera_buffer(camera) {
    const cam_buffer = WASM.#c_module.set_camera_buffer();
    camera.initialize(new Int32Array(WASM.mem, cam_buffer, Camera3D.BUFFER_SIZE));
  }
  static set_light_buffer(light) {
    const light_buffer = WASM.#c_module.set_light_buffer();
    const buffers = new Int32Array(WASM.mem, light_buffer, 1);
    light.initialize(buffers);
  }
  static set_object_buffer(obj3D) {
    const obj_buffer = WASM.#c_module.set_object_buffer(
      obj3D.mesh.numVertices,
      obj3D.mesh.numUVs,
      obj3D.mesh.numNormals
    );
    obj3D.initialize(new Int32Array(WASM.mem, obj_buffer, Object3D.BUFFER_SIZE));
  }

  static initialize() {
    WASM.#c_module.initialize();
  }
}
