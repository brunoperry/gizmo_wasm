import WASM from "./WASM.js";

export default class Display {
  static width = document.querySelector("canvas").width;
  static height = document.querySelector("canvas").height;

  static RenderModes = {
    WIRED: 0,
    SHADED: 1,
    TEXTURED: 2,
  };

  // Where lighting is computed (see C/light3d.h).
  static LightingModes = {
    TRIANGLE: 0,
    VERTEX: 1,
    PIXEL: 2,
  };

  #canvas;
  #context;
  #c_pointer;
  #image_data = null;
  #render_mode_buffer;
  #is_cursor_locked = false;
  constructor() {
    this.#canvas = document.querySelector("canvas");
    Display.width = this.#canvas.width;
    Display.height = this.#canvas.height;
    this.#context = this.#canvas.getContext("2d");
    this.#context.imageSmoothingEnabled = false;

    this.#c_pointer = WASM.set_color_buffer(Display.width, Display.height);
    this.#render_mode_buffer = WASM.set_render_mode_buffer();

    this.render_mode = Display.RenderModes.TEXTURED;
    this.show_grid = true;
  }

  update() {
    this.#context.putImageData(this.#frame(), 0, 0);
  }

  // The ImageData wraps wasm memory directly (no copy). If the wasm memory
  // grows, the old ArrayBuffer is detached and the view must be rebuilt.
  #frame() {
    if (!this.#image_data || this.#image_data.data.buffer !== WASM.mem) {
      const pixels = new Uint8ClampedArray(
        WASM.mem,
        this.#c_pointer,
        Uint32Array.BYTES_PER_ELEMENT * Display.width * Display.height
      );
      this.#image_data = new ImageData(pixels, Display.width);
    }
    return this.#image_data;
  }

  // The render mode buffer holds 5 ints: render mode, lighting mode, show light gizmos, shadows, show grid.
  #settings() {
    return new Int32Array(WASM.mem, this.#render_mode_buffer, 5);
  }
  get render_mode() {
    return this.#settings()[0];
  }
  set render_mode(val) {
    this.#settings()[0] = val;
  }
  get lighting_mode() {
    return this.#settings()[1];
  }
  set lighting_mode(val) {
    this.#settings()[1] = val;
  }
  get show_light_gizmos() {
    return this.#settings()[2] !== 0;
  }
  set show_light_gizmos(val) {
    this.#settings()[2] = val ? 1 : 0;
  }
  get shadows() {
    return this.#settings()[3] !== 0;
  }
  set shadows(val) {
    this.#settings()[3] = val ? 1 : 0;
  }

  get show_grid() {
    return this.#settings()[4] !== 0;
  }
  set show_grid(val) {
    this.#settings()[4] = val ? 1 : 0;
  }

  get lock_cursor() {
    return document.pointerLockElement === this.#canvas;
  }
  // Resolves when the cursor is locked. Rejects when the browser refuses,
  // e.g. when re-locking right after the user pressed Esc.
  request_lock() {
    try {
      const result = this.#canvas.requestPointerLock();
      return result instanceof Promise ? result : Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
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
