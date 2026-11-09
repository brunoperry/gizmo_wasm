import WASM from "./WASM.js";

// Plays a skeleton's animation, as named clips with smooth transitions
// (crossfades). All the meshes of one character share one Animator; the
// pose and the skinning are computed in wasm.
//
//   const inkeeper = Resources.get_objects("inkeeper");
//   const anim = inkeeper[0].animation;
//   anim.play("wave", { fade: 0.3, loop: false });
//   anim.onend = (clip) => anim.play("idle");
//
// Clips are frame ranges of the file's animation (its own frame numbers),
// defined in data.json ("clips": { "idle": [0, 120] }) or with define_clip().
// "default" always covers the whole animation; it starts playing at once.
export default class Animator {
  static DEFAULT_CLIP = "default";
  static DEFAULT_FADE = 0.25; // seconds

  #skeleton;
  #clips = new Map(); // name -> { name, start, end } in data frames (0 = first frame)
  #state = 0; // wasm pointer: frame_a, frame_b, weight_b

  #current = null; // { clip, time, speed, loop, done }
  #previous = null; // the layer fading out
  #fade = 0;
  #fade_time = 0;
  #playing = false;

  // Called with the clip's name when a clip that doesn't loop reaches its end.
  onend = null;

  constructor(skeleton, clips = {}) {
    this.#skeleton = skeleton;
    const first = skeleton.start, last = skeleton.start + skeleton.num_frames - 1;
    this.define_clip(Animator.DEFAULT_CLIP, first, last);
    for (const [name, range] of Object.entries(clips ?? {})) this.define_clip(name, range[0], range[1]);
    this.play(Animator.DEFAULT_CLIP, { fade: 0 });
  }

  get skeleton() {
    return this.#skeleton;
  }

  // Frames are the file's frame numbers (time codes), both included.
  define_clip(name, start, end) {
    const first = this.#skeleton.start, last = first + this.#skeleton.num_frames - 1;
    const clamp = (f) => Math.min(Math.max(f, first), last) - first;
    if (!(end >= start)) throw new Error(`Clip "${name}": end frame must be >= start frame`);
    this.#clips.set(name, { name, start: clamp(start), end: clamp(end) });
  }
  get clips() {
    return [...this.#clips.keys()];
  }

  // Plays a clip, blending from the current pose over `fade` seconds.
  play(name = Animator.DEFAULT_CLIP, { loop = true, speed = 1, fade = Animator.DEFAULT_FADE, time = 0 } = {}) {
    const clip = this.#clips.get(name);
    if (!clip) throw new Error(`No clip "${name}" (clips: ${this.clips.join(", ")})`);
    const layer = { clip, time, speed, loop, done: false };
    if (fade > 0 && this.#current) {
      // Interrupting a fade: keep whichever pose was showing the most.
      const showing = this.#previous && this.#fade_weight() < 0.5 ? this.#previous : this.#current;
      this.#previous = showing;
      this.#fade = fade;
      this.#fade_time = 0;
    } else {
      this.#previous = null;
    }
    this.#current = layer;
    this.#playing = true;
    this.#write();
  }
  pause() {
    this.#playing = false;
  }
  resume() {
    this.#playing = true;
  }
  // Pauses on the first frame of the current clip.
  stop() {
    this.#playing = false;
    this.#previous = null;
    if (this.#current) {
      this.#current.time = 0;
      this.#current.done = false;
    }
    this.#write();
  }

  get playing() {
    return this.#playing;
  }
  get clip() {
    return this.#current?.clip.name ?? null;
  }
  // Seconds into the current clip.
  get time() {
    return this.#current?.time ?? 0;
  }
  set time(val) {
    if (!this.#current) return;
    this.#current.time = val;
    this.#current.done = false;
    this.#wrap(this.#current);
    this.#write();
  }
  get duration() {
    return this.#current ? this.#duration(this.#current.clip) : 0;
  }
  get speed() {
    return this.#current?.speed ?? 1;
  }
  set speed(val) {
    if (!this.#current) return;
    this.#current.speed = val;
    this.#current.done = false; // e.g. played backwards after reaching the end
  }
  get loop() {
    return this.#current?.loop ?? true;
  }
  set loop(val) {
    if (!this.#current) return;
    this.#current.loop = val;
    this.#current.done = false;
  }

  // Called by WASM when the animator gets its wasm state.
  attach(state_pointer) {
    this.#state = state_pointer;
    this.#write();
  }

  // Called by the scene every frame.
  update(delta) {
    if (!this.#playing || !this.#current) return;
    this.#advance(this.#current, delta);
    if (this.#previous) {
      this.#advance(this.#previous, delta);
      this.#fade_time += delta;
      if (this.#fade_time >= this.#fade) this.#previous = null;
    }
    this.#write();
  }

  #duration(clip) {
    return (clip.end - clip.start) / this.#skeleton.fps;
  }
  #advance(layer, delta) {
    if (layer.done) return;
    layer.time += delta * layer.speed;
    const ended = this.#wrap(layer);
    if (ended && layer === this.#current) this.onend?.(layer.clip.name);
  }
  // Loops or clamps the layer's time; true when a non-looping clip just ended.
  #wrap(layer) {
    const duration = this.#duration(layer.clip);
    if (duration <= 0) {
      layer.time = 0;
      return false;
    }
    if (layer.loop) {
      layer.time = ((layer.time % duration) + duration) % duration;
      return false;
    }
    if (layer.time >= duration || layer.time <= 0) {
      const ended = layer.time >= duration ? layer.speed > 0 : layer.speed < 0;
      layer.time = Math.min(Math.max(layer.time, 0), duration);
      if (ended) layer.done = true;
      return ended;
    }
    return false;
  }
  #frame(layer) {
    return layer.clip.start + layer.time * this.#skeleton.fps;
  }
  #fade_weight() {
    const t = this.#fade > 0 ? Math.min(this.#fade_time / this.#fade, 1) : 1;
    return t * t * (3 - 2 * t); // smoothstep: eases in and out
  }
  #write() {
    if (!this.#state || !this.#current) return;
    const current = this.#frame(this.#current);
    const state = this.#previous ? [this.#frame(this.#previous), current, this.#fade_weight()] : [current, current, 0];
    new Float32Array(WASM.mem, this.#state, 3).set(state);
  }
}
