import Display from "./Display.js";
import Resources from "./Resources.js";
import InputController from "./InputController.js";
import WASM from "./WASM.js";

export default class Engine {
  static States = {
    PLAYING: 0,
    STOPPED: 1,
    MODE_CHANGED: 2,
    LOADING: 3,
    READY: 4,
  };

  //debug purposes
  #locked = true;

  #wasm = null;
  #display = null;
  #audio = null;

  #scene = null;

  #loopID = null;
  #delta_time = 0;
  #frame = 0;
  #current_fps = 0;
  #start_time = performance.now();
  #previous_frame_time = 0;

  #listener = null;
  constructor(listener) {
    this.#listener = listener;
  }

  async start_engine(scene) {
    await Resources.initialize(this.#listener, Engine.States.LOADING);

    const { instance } = await WebAssembly.instantiateStreaming(
      fetch("./src/gizmo.wasm"),
      {
        js: {
          console_log: WASM.wasm_log,
          info_log: WASM.wasm_info,
          log_matrix: WASM.log_matrix,
          log_triangle: WASM.log_triangle,
          log_float: WASM.log_float,
          log_vec3: WASM.log_vec3,
          log_vec4: WASM.log_vec4,
        },
      }
    );

    this.#wasm = new WASM(instance.exports);
    this.#scene = new scene();
    // this.#audio = new AudioController();
    this.#display = new Display();
    WASM.initialize();

    document.addEventListener("pointerlockchange", (e) => {
      if (!this.#display.lock_cursor) this.stop();
    });

    this.#listener(Engine.States.READY, "Ready!");
  }

  test() {
    // this.#scene.update(this.#delta_time);

    this.#scene.update(this.#delta_time);

    this.#wasm.update();

    this.#display.update();

    // this.#wasm.update_once();
    // this.#display.update();
    // this.#display.update_once(this.#scene);
  }

  play() {
    if (this.#loopID) return;
    // this.#display.lock_cursor = true;
    this.#loopID = requestAnimationFrame(() => this.#loop());
    this.#listener(Engine.States.PLAYING);
  }

  stop() {
    if (!this.#loopID) return;

    this.#display.lock_cursor = false;
    cancelAnimationFrame(this.#loopID);
    this.#loopID = null;
    this.#listener(Engine.States.STOPPED);
  }

  #loop() {
    let time = performance.now();
    this.#delta_time = (time - this.#previous_frame_time) / 1000.0;
    this.#frame++;
    if (time - this.#start_time > 1000) {
      this.#current_fps = (this.#frame / ((time - this.#start_time) / 1000)).toFixed(1);

      this.#start_time = time;
      this.#frame = 0;
    }
    this.#previous_frame_time = time;

    this.#scene.update(this.#delta_time);

    this.#wasm.update();

    this.#display.update();

    this.#loopID = requestAnimationFrame((e) => this.#loop(e));
  }

  get render_mode() {
    return this.#display.render_mode;
  }
  set render_mode(val) {
    this.#display.render_mode = val;
    this.#wasm.update();

    //debug purposes, clear the if statment for production
    if (!this.#locked) this.#display.update();

    this.#listener(Engine.States.MODE_CHANGED);
  }

  get is_running() {
    return this.#loopID;
  }
  get scene_name() {
    return this.#scene.name;
  }
  get memory() {
    return WASM.mem_size;
  }
  get fps() {
    return this.#current_fps;
  }

  //debug purposes
  get unlock() {
    return this.#locked;
  }
  set unlock(val) {
    this.#locked = !val;
  }
}
