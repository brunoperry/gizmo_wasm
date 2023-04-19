import WASM from "./WASM.js";
import {
  mat4_mul_mat4,
  mat4_mul_vec3,
  mat4_mul_vec4,
  vec3,
  vec3_add,
  vec4_divide_scalar_2d,
  vec4_from_vec3,
} from "./math.js";

export default class Display {
  static width = document.querySelector("canvas").width;
  static height = document.querySelector("canvas").height;

  static RenderModes = {
    WIRED: 0,
    SHADED: 1,
    TEXTURED: 2,
  };

  #canvas;
  #context;
  #c_buffer;
  #render_mode_buffer;
  #is_cursor_locked = false;
  constructor() {
    this.#canvas = document.querySelector("canvas");
    Display.width = this.#canvas.width;
    Display.height = this.#canvas.height;
    this.#context = this.#canvas.getContext("2d");
    this.#context.imageSmoothingEnabled = false;
    const cb_pointer = WASM.set_display_buffer(Display.width, Display.height);
    this.#c_buffer = new Uint8ClampedArray(
      WASM.mem,
      cb_pointer,
      Uint32Array.BYTES_PER_ELEMENT * Display.width * Display.height
    );
  }

  update() {
    this.#context.putImageData(new ImageData(this.#c_buffer, Display.width), 0, 0);
  }
  update_once(scene) {
    this.#c_buffer = new Uint8ClampedArray(Display.width * Display.height * 4);
    this.#display_clear();

    const objs = scene.objects_3d;
    const viewMatrix = scene.camera.view_matrix;
    const projectionMatrix = scene.camera.projection_matrix;
    objs.forEach((obj3d) => {
      obj3d.update();
      const modelMatrix = obj3d.model_matrix;
      const modelView = mat4_mul_mat4(viewMatrix, modelMatrix);
      const mvp = mat4_mul_mat4(projectionMatrix, modelView);
      const triangles = this.#project_triangles(obj3d, mvp);

      this.#display_draw(triangles);
    });
    this.update();
  }
  #project_triangles(obj3d, mvp) {
    const triangles_out = [];
    const triangles_in = [];

    const verts = obj3d.mesh.vertices;
    for (let i = 0; i < verts.length; i += 9) {
      triangles_in.push({
        a: vec3(verts[i + 0], verts[i + 1], verts[i + 2]),
        b: vec3(verts[i + 3], verts[i + 4], verts[i + 5]),
        c: vec3(verts[i + 6], verts[i + 7], verts[i + 8]),
      });
      triangles_out.push({
        a: vec3(),
        b: vec3(),
        c: vec3(),
      });
    }

    const center = vec3(Display.width / 2, Display.height / 2, 0);
    for (let i = 0; i < triangles_in.length; i++) {
      // Apply the view-projection matrix to each vertex of the triangle

      const a = mat4_mul_vec4(mvp, vec4_from_vec3(triangles_in[i].a));
      const b = mat4_mul_vec4(mvp, vec4_from_vec3(triangles_in[i].b));
      const c = mat4_mul_vec4(mvp, vec4_from_vec3(triangles_in[i].c));

      // Divide by w to get the projected coordinates, center to screen and store the projected triangle
      triangles_out[i].a = vec3_add(vec4_divide_scalar_2d(a, a.w), center);
      triangles_out[i].b = vec3_add(vec4_divide_scalar_2d(b, b.w), center);
      triangles_out[i].c = vec3_add(vec4_divide_scalar_2d(c, c.w), center);
    }
    return triangles_out;
  }
  #display_draw(triangles) {
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i];
      this.#draw_pixel(tri.a.x, tri.a.y);
      this.#draw_pixel(tri.b.x, tri.b.y);
      this.#draw_pixel(tri.c.x, tri.c.y);
    }
  }
  #draw_pixel(x, y) {
    if (x >= 0 && x < Display.width && y >= 0 && y < Display.height) {
      const index = parseInt(4 * (x + y * Display.width));
      this.#c_buffer[index + 0] = 255;
      this.#c_buffer[index + 1] = 255;
      this.#c_buffer[index + 2] = 255;
      this.#c_buffer[index + 3] = 255;
    }
  }
  #display_clear() {
    for (let i = 0; i < this.#c_buffer.length; i += 4) {
      this.#c_buffer[i] = 0; // red channel
      this.#c_buffer[i + 1] = 0; // green channel
      this.#c_buffer[i + 2] = 0; // blue channel
      this.#c_buffer[i + 3] = 255; // alpha channel (opaque)
    }
  }

  get render_mode() {
    return new Int32Array(WASM.mem, this.#render_mode_buffer, 1)[0];
  }
  set render_mode(val) {
    new Int32Array(WASM.mem, this.#render_mode_buffer, 1).set([val]);
  }

  get lock_cursor() {
    return document.pointerLockElement === this.#canvas;
  }
  set lock_cursor(val) {
    this.#is_cursor_locked = val;
    if (this.#is_cursor_locked) {
      this.#canvas.requestPointerLock();
    } else {
      document.exitPointerLock();
    }
  }
}
