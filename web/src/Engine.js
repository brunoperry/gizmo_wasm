import Display from "./Display.js";
import Resources from "./Resources.js";
import InputController from "./InputController.js";
import WASM from "./WASM.js";
import AudioController from "./AudioControler.js";

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

  // #wasm = null;
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
    await WASM.initialize();
    await Resources.initialize(this.#listener, Engine.States.LOADING);
    InputController.initialize();

    this.#scene = new scene();
    // this.#audio = new AudioController();
    this.#display = new Display();

    document.addEventListener("pointerlockchange", (e) => {
      if (!this.#display.lock_cursor) this.stop();
    });

    this.#listener(Engine.States.READY, "Ready!");
  }

  play() {
    if (this.#loopID) return;
    this.#display.lock_cursor = true;
    this.#loopID = requestAnimationFrame(() => this.#loop());
    // this.#audio.play();

    this.#listener(Engine.States.PLAYING);
  }
  playOnce() {
    this.#listener(Engine.States.PLAYING);
    this.#loop(true);
    this.#loopID = null;
    this.#listener(Engine.States.STOPPED);
  }

  stop() {
    if (!this.#loopID) return;

    this.#display.lock_cursor = false;
    cancelAnimationFrame(this.#loopID);
    this.#loopID = null;
    // this.#audio.pause();
    this.#listener(Engine.States.STOPPED);
  }

  #loop(once = false) {
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

    WASM.update();

    this.#display.update();

    if (!once) this.#loopID = requestAnimationFrame(() => this.#loop());
  }

  applyFilter(filter) {
    WASM.apply_filter(filter);
    this.#display.update();
  }

  getFrequency(freqIndex) {
    return this.#audio.get_frequency(freqIndex);
  }
  getAudioTrack(audioIndex) {
    return this.#audio.get_track(audioIndex);
  }

  get render_mode() {
    return this.#display.render_mode;
  }
  set render_mode(val) {
    this.#display.render_mode = val;
    WASM.update();

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
