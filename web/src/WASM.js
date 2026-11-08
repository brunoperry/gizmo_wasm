export default class WASM {
  static #c_module = null;

  constructor() {}

  static async initialize() {
    const { instance } = await WebAssembly.instantiateStreaming(fetch("./src/gizmo.wasm"), {
      js: {
        console_log: WASM.wasm_log,
        info_log: WASM.wasm_info,
        float_log: WASM.float_log,
        int_log: WASM.int_log,
        vec3_log: WASM.vec3_log,
      },
    });
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

  // Every set_* in C returns 0 when it runs out of slots or memory.
  static #check(pointer, what) {
    if (!pointer) throw new Error(`gizmo.wasm: could not allocate ${what}`);
    return pointer;
  }

  static update() {
    WASM.#c_module.update();
  }

  // Everything allocated from now on belongs to the scene (see scene_clear).
  static scene_begin() {
    WASM.#c_module.scene_begin();
  }
  // Frees the scene: camera, lights, objects, skeletons, textures... (all
  // created after scene_begin). Returns how many textures are left (0).
  static scene_clear() {
    WASM.#skeleton_ids = new WeakMap();
    WASM.#animator_ids = new WeakMap();
    return WASM.#c_module.scene_clear();
  }

  // World-space box around every object: { min, max } as [x, y, z], or null
  // if there's nothing to bound.
  static scene_bounds() {
    const b = new Float32Array(WASM.mem, WASM.#c_module.scene_bounds(), 7);
    if (!b[6]) return null;
    return { min: [b[0], b[1], b[2]], max: [b[3], b[4], b[5]] };
  }

  static set_color_buffer(width, height) {
    return WASM.#check(WASM.#c_module.set_color_buffer(width, height), "color buffer");
  }
  static set_texture_buffer(width, height, id) {
    return WASM.#check(WASM.#c_module.set_texture_buffer(width, height, id), "texture");
  }
  static set_render_mode_buffer() {
    return WASM.#check(WASM.#c_module.set_render_mode_buffer(), "render mode");
  }
  static set_camera_buffer(camera) {
    const cam_buffer = WASM.#check(WASM.#c_module.set_camera_buffer(), "camera");
    const buffers = new Int32Array(WASM.mem, cam_buffer, 9);
    camera.initialize(buffers);
    WASM.#c_module.cam_done();
  }
  // Pointer to the light block (layout in C/light3d.h), see Scene.js.
  static set_light_buffer() {
    return WASM.#check(WASM.#c_module.set_light_buffer(), "lights");
  }
  static #skeleton_ids = new WeakMap(); // skeleton data -> wasm id (uploaded once)
  static #animators = new WeakSet(); // Animators with wasm state

  // Skeleton + animation, shared by every instance: uploaded once.
  static #upload_skeleton(skeleton) {
    if (WASM.#skeleton_ids.has(skeleton)) return WASM.#skeleton_ids.get(skeleton);
    const ptr = WASM.#check(
      WASM.#c_module.set_skeleton_buffer(skeleton.num_joints, skeleton.num_frames),
      `skeleton ${skeleton.path}`
    );
    const [id, parents, order, inv_bind, to_object, frames] = new Uint32Array(WASM.mem, ptr, 6);
    new Int32Array(WASM.mem, parents, skeleton.num_joints).set(skeleton.parents);
    new Int32Array(WASM.mem, order, skeleton.num_joints).set(skeleton.order);
    new Float32Array(WASM.mem, inv_bind, skeleton.num_joints * 16).set(skeleton.inv_bind);
    new Float32Array(WASM.mem, to_object, 16).set(skeleton.to_object);
    new Float32Array(WASM.mem, frames, skeleton.frames.length).set(skeleton.frames);
    WASM.#skeleton_ids.set(skeleton, id);
    return id;
  }
  static #animator_ids = new WeakMap();
  static #animator_id(animator) {
    if (WASM.#animator_ids.has(animator)) return WASM.#animator_ids.get(animator);
    const skeleton_id = WASM.#upload_skeleton(animator.skeleton);
    const ptr = WASM.#check(WASM.#c_module.create_animator(skeleton_id), "animator");
    const [id, state] = new Uint32Array(WASM.mem, ptr, 2);
    WASM.#animator_ids.set(animator, id);
    animator.attach(state);
    return id;
  }
  // Called between set_object_buffer and obj_done.
  static #set_skin(obj3D) {
    const skin = obj3D.skin;
    const num_points = skin.bind_points.length / 3;
    const ptr = WASM.#check(
      WASM.#c_module.set_skin_buffer(
        WASM.#animator_id(obj3D.animation),
        num_points,
        skin.influences,
        skin.method === "dualQuaternion" ? 1 : 0,
        skin.bind_normals ? 1 : 0
      ),
      `skin of ${obj3D.name}`
    );
    const [bind_points, joints, weights, corner_points, bind_normals] = new Uint32Array(WASM.mem, ptr, 5);
    new Float32Array(WASM.mem, bind_points, skin.bind_points.length).set(skin.bind_points);
    new Int32Array(WASM.mem, joints, skin.joints.length).set(skin.joints);
    new Float32Array(WASM.mem, weights, skin.weights.length).set(skin.weights);
    new Int32Array(WASM.mem, corner_points, skin.corner_points.length).set(skin.corner_points);
    if (skin.bind_normals) new Float32Array(WASM.mem, bind_normals, skin.bind_normals.length).set(skin.bind_normals);
  }

  // texture_id: see Resources.texture_id (-1 = untextured).
  static set_object_buffer(obj3D, texture_id = -1) {
    const obj_buffer = WASM.#check(
      WASM.#c_module.set_object_buffer(
        obj3D.vertices.length,
        obj3D.uvs.length,
        obj3D.normals.length,
        texture_id
      ),
      `object ${obj3D.name}`
    );
    const buffers = new Int32Array(WASM.mem, obj_buffer, 7);
    obj3D.initialize(buffers);
    if (obj3D.skin && obj3D.animation) WASM.#set_skin(obj3D);
    WASM.#c_module.obj_done();
  }

  static apply_filter(filter) {
    switch (filter) {
      case "barrel":
        WASM.#c_module.apply_filter(0);
        break;
      case "fisheye":
        WASM.#c_module.apply_filter(1);
        break;
    }
  }

  static get mem() {
    return WASM.#c_module.memory.buffer;
  }
  static get mem_size() {
    return WASM.#c_module.memory.buffer.byteLength;
  }
}
