import Display from "./Display.js";
import Resources from "./Resources.js";
import InputController from "./InputController.js";
import WASM from "./WASM.js";
import AudioController from "./AudioControler.js";
import ModelScene from "./ModelScene.js";

export default class Engine {
  static States = {
    PLAYING: 0,
    STOPPED: 1,
    MODE_CHANGED: 2,
    LOADING: 3,
    READY: 4,
    FILTER_CHANGED: 5,
    LIGHTING_CHANGED: 6,
    DISPLAY_CHANGED: 7,
    SCENE_CHANGED: 8,
  };

  // Filters that stay on (applied to every frame) until toggled off; one at
  // a time, so turning one on replaces the other. The rest (none for now)
  // are applied once to the current frame.
  static PERSISTENT_FILTERS = ["fisheye", "barrel"];
  #filter = null;

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

  // Longest step the simulation takes (tab switches, breakpoints...).
  static MAX_DELTA = 0.1;
  static FIXED_DELTA = 1 / 60;

  #listener = null;
  constructor(listener) {
    this.#listener = listener;
  }

  async start_engine(scene) {
    await WASM.initialize();
    await Resources.initialize(this.#listener, Engine.States.LOADING);
    InputController.initialize();

    // this.#audio = new AudioController();
    this.#display = new Display();

    // From here on, wasm memory belongs to the scene (freed by load_scene),
    // textures included.
    WASM.scene_begin();
    this.#scene = new scene();

    document.addEventListener("pointerlockchange", (e) => {
      if (!this.#display.lock_cursor) this.stop();
    });

    this.#listener(Engine.States.READY, "Ready!");
  }

  play() {
    if (this.#loopID) return;
    // Without the lock there's no mouse look and Esc can't stop the loop,
    // so don't keep running if the browser refuses it.
    this.#display.request_lock().catch((error) => {
      console.warn("Pointer lock refused:", error.message);
      this.stop();
    });
    this.#previous_frame_time = performance.now();
    this.#loopID = requestAnimationFrame(() => this.#loop());
    // this.#audio.play();

    this.#listener(Engine.States.PLAYING);
  }
  playOnce() {
    if (this.#loopID) return; // already running
    this.#listener(Engine.States.PLAYING);
    this.#loop(true);
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
    this.#delta_time = once
      ? Engine.FIXED_DELTA
      : Math.min((time - this.#previous_frame_time) / 1000.0, Engine.MAX_DELTA);
    this.#frame++;
    if (time - this.#start_time > 1000) {
      this.#current_fps = (this.#frame / ((time - this.#start_time) / 1000)).toFixed(1);

      this.#start_time = time;
      this.#frame = 0;
    }
    this.#previous_frame_time = time;

    this.#scene?.update(this.#delta_time);

    this.#render();

    this.#display.update();

    if (!once) this.#loopID = requestAnimationFrame(() => this.#loop());
  }

  #render() {
    WASM.update();
    if (this.#filter) WASM.apply_filter(this.#filter);
  }

  // Replaces the scene: frees the current one (wasm memory included), then
  // `build()` creates the new one. Shows it right away, even while paused.
  // SCENE_CHANGED gets { name, model }: the data.json entry shown, or null.
  load_scene(build, model = null) {
    this.#scene = null;
    WASM.scene_clear();
    Resources.scene_cleared();
    this.#scene = build();
    this.#render();
    this.#display.update();
    this.#listener(Engine.States.SCENE_CHANGED, { name: this.#scene.name, model });
  }
  // A model from data.json (Scene > Models), by its entry name. Loaded the
  // first time it's picked; the current scene stays until it's ready.
  async load_model(name) {
    await Resources.load_model(name);
    this.load_scene(() => new ModelScene(name, Resources.get_objects(name)), name);
  }
  // A model picked from the computer, with its textures (see
  // Resources.load_files). The current scene stays if the files can't be read.
  // Returns the loader's warnings.
  async open_files(files) {
    const model = await Resources.load_files(files);
    this.load_scene(() => new ModelScene(model.name, model.objects));
    return model.warnings;
  }

  applyFilter(filter) {
    if (Engine.PERSISTENT_FILTERS.includes(filter)) {
      this.#filter = this.#filter === filter ? null : filter;
      // While paused, redraw so the change shows right away.
      if (!this.#loopID) {
        this.#render();
        this.#display.update();
      }
      this.#listener(Engine.States.FILTER_CHANGED, this.#filter);
      return;
    }
    WASM.apply_filter(filter);
    this.#display.update();
  }

  getFrequency(freqIndex) {
    return this.#audio ? this.#audio.get_frequency(freqIndex) : null;
  }
  getAudioTrack(audioIndex) {
    return this.#audio ? this.#audio.get_track(audioIndex) : null;
  }

  // Redraws the current frame while paused, so setting changes show at once.
  #refresh() {
    if (this.#loopID) return;
    this.#render();
    if (!this.#locked) this.#display.update();
  }

  get lighting_mode() {
    return this.#display.lighting_mode;
  }
  set lighting_mode(val) {
    this.#display.lighting_mode = val;
    this.#refresh();
    this.#listener(Engine.States.LIGHTING_CHANGED);
  }
  get show_light_gizmos() {
    return this.#display.show_light_gizmos;
  }
  set show_light_gizmos(val) {
    this.#display.show_light_gizmos = val;
    this.#refresh();
    this.#listener(Engine.States.LIGHTING_CHANGED);
  }

  get shadows() {
    return this.#display.shadows;
  }
  set shadows(val) {
    this.#display.shadows = val;
    this.#refresh();
    this.#listener(Engine.States.LIGHTING_CHANGED);
  }

  get show_grid() {
    return this.#display.show_grid;
  }
  set show_grid(val) {
    this.#display.show_grid = val;
    this.#refresh();
    this.#listener(Engine.States.DISPLAY_CHANGED);
  }

  get render_mode() {
    return this.#display.render_mode;
  }
  set render_mode(val) {
    this.#display.render_mode = val;
    this.#render();

    //debug purposes, clear the if statment for production
    if (!this.#locked) this.#display.update();

    this.#listener(Engine.States.MODE_CHANGED);
  }

  get is_running() {
    return this.#loopID;
  }
  get camera() {
    return this.#scene?.camera ?? null;
  }
  get scene_name() {
    return this.#scene?.name;
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
