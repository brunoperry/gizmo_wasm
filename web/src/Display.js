import Resources from "./Resources.js";
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
  #c_buffer;
  #render_mode_buffer;
  #is_cursor_locked = false;
  constructor() {
    this.#canvas = document.querySelector("canvas");
    Display.width = this.#canvas.width;
    Display.height = this.#canvas.height;
    this.#context = this.#canvas.getContext("2d");
    this.#context.imageSmoothingEnabled = false;
    const cb_pointer = WASM.set_color_buffer(Display.width, Display.height);
    this.#c_buffer = new Uint8ClampedArray(
      WASM.mem,
      cb_pointer,
      Uint32Array.BYTES_PER_ELEMENT * Display.width * Display.height
    );

    this.#render_mode_buffer = WASM.set_render_mode_buffer();

    this.render_mode = Display.RenderModes.TEXTURED;
  }

  update() {
    this.#context.putImageData(new ImageData(this.#c_buffer, Display.width), 0, 0);
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
