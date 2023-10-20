import Resources from "./Resources.js";

export default class AudioController {
  #trks;
  #main_track;
  #audio_ctx;
  #vol = 0.5;
  #listener;
  constructor(listener = null) {
    this.#trks = Resources.audios;
    this.#main_track = Resources.main_audio;
    this.#audio_ctx = new AudioContext();

    this.#listener = listener;
    if (listener) {
      this.#main_track.set_listener((e) => {
        this.#listener({
          type: e,
        });
      });
    }

    this.reset();
  }

  async reset() {
    if (this.#audio_ctx) {
      const t = await this.#audio_ctx.close();
    }
    this.#audio_ctx = null;

    this.#audio_ctx = new AudioContext();
    this.#main_track.set_audio_context(this.#audio_ctx);
    this.#trks.forEach((trk) => {
      trk.set_audio_context(this.#audio_ctx);
    });
  }

  get_frequency(from, freq) {
    return this.#trks[from].get_frequency(freq);
  }

  play() {
    this.#audio_ctx.resume();
    this.volume = 0.1;
    this.#main_track.play();
    this.#trks.forEach((trk) => {
      trk.play();
    });
  }

  pause() {
    this.#audio_ctx.suspend();
    this.#main_track.pause();
    this.#trks.forEach((trk) => {
      trk.pause();
    });
  }

  stop() {
    this.#audio_ctx.suspend();
    this.#main_track.stop();
    this.#trks.forEach((trk) => {
      trk.stop();
    });
  }
  get_tracks() {
    return this.#trks;
  }
  set_track(id, value) {
    this.#trks[id].active = value;
  }
  get_track(id) {
    return this.#trks[id];
  }

  set volume(vol) {
    this.#vol = vol;
    this.#trks.forEach((trk) => {
      trk.volume = vol;
    });
  }
  get volume() {
    return this.#vol;
  }

  setTimeAt(time) {}
}
