import WASM from "./WASM.js";

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

  get render_mode() {
    return new Int32Array(WASM.mem, this.#render_mode_buffer, 1)[0];
  }
  set render_mode(val) {
    new Int32Array(WASM.mem, this.#render_mode_buffer, 1).set([val]);
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
