import WASM from "./WASM.js";

export default class Mesh {
  #verts;
  #UVs;
  #norms;
  constructor({ vertices, uvs, normals }) {
    this.#verts = vertices;
    this.#UVs = uvs;
    this.#norms = normals;
  }

  initialize(vertex_buffer, uv_buffer, normal_buffer) {
    new Float32Array(WASM.mem, vertex_buffer, this.numVertices).set(this.#verts);
    new Float32Array(WASM.mem, uv_buffer, this.numUVs).set(this.#UVs);
    new Float32Array(WASM.mem, normal_buffer, this.numNormals).set(this.#norms);
  }
  get vertices() {
    return this.#verts;
  }
  get numVertices() {
    return this.#verts.length;
  }
  get uvs() {
    return this.#UVs;
  }
  get numUVs() {
    return this.#UVs.length;
  }
  get normals() {
    return this.#norms;
  }
  get numNormals() {
    return this.#norms.length;
  }
  get numTriangles() {
    return this.#verts.length / 3;
  }
}
