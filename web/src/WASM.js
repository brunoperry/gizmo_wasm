export default class WASM {
  static #c_module = null;

  constructor() {}

  static async initialize() {
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch("./src/gizmo.wasm"),
      {
        js: {
          console_log: WASM.wasm_log,
          info_log: WASM.wasm_info,
          float_log: WASM.float_log,
          int_log: WASM.int_log,
          vec3_log: WASM.vec3_log,
          vec4_log: WASM.vec4_log,
          mat4_log: WASM.mat4_log,
        },
      }
    );
    WASM.#c_module = instance.exports;
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
  static float_log(value) {
    console.log("float", value);
  }
  static int_log(value) {
    console.log("int", value);
  }
  static vec3_log(x, y, z) {
    console.log("vec3", `x:${x}, y:${y}, z:${z}`);
  }
  static vec4_log(x, y, z, w) {
    console.log("vec4", `x:${x}, y:${y}, z:${z}, w:${w}`);
  }
  static mat4_log(x, y, z) {
    console.log("vec3", `x:${x},y:${y},z:${z}`);
  }

  static update() {
    WASM.#c_module.update();
  }

  static set_color_buffer(width, height) {
    return WASM.#c_module.set_color_buffer(width, height);
  }
  static set_render_mode_buffer() {
    return WASM.#c_module.set_render_mode_buffer();
  }

  static set_weapon_buffer(weapon) {
    const weapon_buffer = WASM.#c_module.set_weapon_buffer();
    const buffers = new Int32Array(WASM.mem, weapon_buffer, 9);
    camera.initialize(buffers);
    WASM.#c_module.cam_done();
  }

  static set_cam_buffer(camera) {
    const cam_buffer = WASM.#c_module.set_cam_buffer();
    camera.initialize(cam_buffer);
  }
  static set_camera_buffer(camera) {
    const cam_buffer = WASM.#c_module.set_camera_buffer();
    const buffers = new Int32Array(WASM.mem, cam_buffer, 9);
    camera.initialize(buffers);
    WASM.#c_module.cam_done();
  }
  static set_light_buffer(light) {
    const light_buffer = WASM.#c_module.set_light_buffer();
    const buffers = new Int32Array(WASM.mem, light_buffer, 1);
    light.initialize(buffers);
    WASM.#c_module.light_done();
  }
  static set_object_buffer(obj3D) {
    const obj_buffer = WASM.#c_module.set_object_buffer(
      obj3D.vertices.length,
      obj3D.uvs.length,
      obj3D.normals.length,
      obj3D.texture.width,
      obj3D.texture.height
    );
    const buffers = new Int32Array(WASM.mem, obj_buffer, 7);
    obj3D.initialize(buffers);
    WASM.#c_module.obj_done();
  }

  static get mem() {
    return WASM.#c_module.memory.buffer;
  }
  static get mem_size() {
    return WASM.#c_module.memory.buffer.byteLength;
  }
}
