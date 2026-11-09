import { angleToRadians, vec3 } from "./math.js";
import Texture from "./Texture.js";
import WASM from "./WASM.js";
import { compute_normals } from "./Normals.js";

export default class Object3D {
  #obj_data = null;

  #p_buffer;
  #r_buffer;
  #s_buffer;
  #shadow_buffer; // int: casts shadows
  #cast_shadows = true;
  #pos = vec3(0, 0, 0);
  #rot = vec3(0, 0, 0);
  #scl = vec3(1, 1, 1);
  // The playing Animator of a skinned object (shared by a character's meshes).
  animation = null;

  constructor(data) {
    this.#obj_data = data;
  }

  // Builds an object from indexed faces: (point, uv, normal) index triplets,
  // three per triangle, as the OBJ/FBX/USD loaders produce. Every triangle
  // corner gets its own copy (triangle soup); invalid indices give zeros.
  // A `skin` (USD skeletal animation) is converted to per-corner data too.
  // Corners without a normal in the file get one computed (see Normals.js).
  static from_faces(mesh_data) {
    const corners = mesh_data.faces.length / 3;
    const expand = (source, size, offset) => {
      const out = new Float32Array(corners * size);
      for (let i = 0, o = 0; i < mesh_data.faces.length; i += 3, o += size) {
        const index = mesh_data.faces[i + offset];
        if (index < 0 || (index + 1) * size > source.length) continue;
        for (let k = 0; k < size; k++) out[o + k] = source[index * size + k];
      }
      return out;
    };

    const corner_points = new Int32Array(corners);
    for (let c = 0; c < corners; c++) corner_points[c] = mesh_data.faces[c * 3];
    // Fills the corners that have no (valid) normal with computed ones.
    const complete_normals = (normals, points) => {
      let generated = null;
      for (let c = 0; c < corners; c++) {
        const o = c * 3;
        if (normals[o] !== 0 || normals[o + 1] !== 0 || normals[o + 2] !== 0) continue;
        generated ??= compute_normals(points, corner_points, mesh_data.crease_angle);
        normals[o] = generated[o], normals[o + 1] = generated[o + 1], normals[o + 2] = generated[o + 2];
      }
      return normals;
    };

    let skin = null;
    if (mesh_data.skin) {
      const s = mesh_data.skin;
      skin = {
        skeleton: s.skeleton,
        method: s.method,
        influences: s.influences,
        joints: s.joints,
        weights: s.weights,
        bind_points: s.bind_points,
        bind_normals: complete_normals(
          s.bind_normals ? expand(s.bind_normals, 3, 2) : new Float32Array(corners * 3),
          s.bind_points
        ),
        corner_points,
      };
    }

    return new Object3D({
      vertices: expand(mesh_data.vertices, 3, 0),
      uvs: expand(mesh_data.uvs, 2, 1),
      normals: complete_normals(expand(mesh_data.normals, 3, 2), mesh_data.vertices),
      name: mesh_data.name,
      texture: mesh_data.texture,
      skin,
    });
  }

  initialize(buffers) {
    new Float32Array(WASM.mem, buffers[0], this.vertices.length).set(this.vertices);
    new Float32Array(WASM.mem, buffers[1], this.uvs.length).set(this.uvs);
    new Float32Array(WASM.mem, buffers[2], this.normals.length).set(this.normals);
    this.#p_buffer = buffers[3];
    this.#r_buffer = buffers[4];
    this.#s_buffer = buffers[5];
    this.#shadow_buffer = buffers[7];

    this.position = vec3(0, 0, 0);
    this.rotation = vec3(0, 0, 0);
    this.scale = vec3(1, 1, 1);
    this.cast_shadows = this.#cast_shadows;
  }

  clone() {
    const obj = new Object3D(this.#obj_data);
    obj.texture = this.texture;
    return obj;
  }

  get position() {
    return this.#pos;
  }
  set position(vec) {
    this.#pos = vec;

    new Float32Array(WASM.mem, this.#p_buffer, 3).set([vec.x, vec.y, vec.z]);
  }

  get rotation() {
    return this.#rot;
  }
  set rotation(vec) {
    this.#rot = vec;
    new Float32Array(WASM.mem, this.#r_buffer, 3).set([
      angleToRadians(vec.x),
      angleToRadians(vec.y),
      angleToRadians(vec.z),
    ]);
  }

  get scale() {
    return this.#scl;
  }
  set scale(vec) {
    this.#scl = vec;
    if (!this.#s_buffer) return;
    new Float32Array(WASM.mem, this.#s_buffer, 3).set([vec.x, vec.y, vec.z]);
  }

  // false: the object is left out of the shadow maps (it still receives
  // shadows). For ground and other things with nothing behind them: maps
  // render faster and the lookups over them cost almost nothing.
  get cast_shadows() {
    return this.#cast_shadows;
  }
  set cast_shadows(on) {
    this.#cast_shadows = !!on;
    if (!this.#shadow_buffer) return;
    new Int32Array(WASM.mem, this.#shadow_buffer, 1)[0] = this.#cast_shadows ? 1 : 0;
  }

  get name() {
    return this.#obj_data.name;
  }
  get vertices() {
    return this.#obj_data.vertices;
  }
  get uvs() {
    return this.#obj_data.uvs;
  }
  get normals() {
    return this.#obj_data.normals;
  }
  get data() {
    return this.#obj_data;
  }
  // Skeletal animation data, or null for rigid objects.
  get skin() {
    return this.#obj_data.skin ?? null;
  }
}
