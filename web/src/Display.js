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
    // this.apply_fisheye();

    this.#context.putImageData(new ImageData(this.#c_buffer, Display.width), 0, 0);
  }

  apply_fisheye() {
    // const data = new ImageData(this.#c_buffer, Display.width);

    const data = new Uint8ClampedArray(
      Uint32Array.BYTES_PER_ELEMENT * Display.width * Display.height
    );

    const k = 0.0001; // Distortion strength
    const centerX = Display.width / 2;
    const centerY = Display.height / 2;

    for (let y = 0; y < Display.height; y++) {
      for (let x = 0; x < Display.width; x++) {
        // Calculate distance from center
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        // Calculate angle from center
        const theta = Math.atan2(y - centerY, x - centerX);
        // Calculate distorted radius
        const r = distance * (1 + k * distance ** 2);
        // Calculate distorted coordinates
        const xDistorted = Math.round(centerX + r * Math.cos(theta));
        const yDistorted = Math.round(centerY + r * Math.sin(theta));
        // Check if distorted coordinates are within image bounds
        if (
          xDistorted >= 0 &&
          xDistorted < Display.width &&
          yDistorted >= 0 &&
          yDistorted < Display.height
        ) {
          // Distort the pixel
          const index = (y * Display.width + x) * 4;
          const distortedIndex = (yDistorted * Display.width + xDistorted) * 4;
          this.#c_buffer[index] = this.#c_buffer[distortedIndex];
          this.#c_buffer[index + 1] = this.#c_buffer[distortedIndex + 1];
          this.#c_buffer[index + 2] = this.#c_buffer[distortedIndex + 2];
          this.#c_buffer[index + 3] = this.#c_buffer[distortedIndex + 3];
        }
      }
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
