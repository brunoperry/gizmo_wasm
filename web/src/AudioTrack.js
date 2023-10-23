export default class AudioTrack {
  #audio_ctx;
  #buffer;
  #audio_buffer = null;
  #source_node = null;
  #started_at = 0;
  #paused_at = 0;
  #gainNode = null;
  #analizer = null;
  #fbc = null;
  #vol = 0.1;
  #is_active = true;
  #listener = null;

  is_playing = false;
  name;
  constructor(buffer, name) {
    this.#buffer = buffer;
    this.name = name;
  }

  get_frequency(val) {
    this.#analizer.getByteFrequencyData(this.#fbc);
    return this.#fbc[val] / 255;
  }

  set_listener(listener) {
    this.#listener = listener;
  }

  async set_audio_context(context) {
    this.#audio_ctx = context;

    const buff = this.#buffer.slice(0, this.#buffer.byteLength);
    this.#audio_buffer = await this.#audio_ctx.decodeAudioData(buff);
    this.#gainNode = this.#audio_ctx.createGain();
    this.#analizer = this.#audio_ctx.createAnalyser();
    this.#analizer.smoothingTimeConstant = 0.9;

    this.#fbc = new Uint8Array(this.#analizer.frequencyBinCount);

    console.log(this.#fbc[0]);
    if (this.name === "main") {
      this.volume = 0;
    }
  }

  play() {
    if (this.is_playing) return;
    if (this.#listener) this.#listener("audioplay");
    this.#source_node = this.#audio_ctx.createBufferSource();
    this.#source_node.onended = () => {
      if (this.#audio_ctx.currentTime > this.duration) {
        if (this.#listener) this.#listener("audioend");
      }
    };
    this.#source_node.buffer = this.#audio_buffer;
    this.#source_node
      .connect(this.#gainNode)
      .connect(this.#analizer)
      .connect(this.#audio_ctx.destination);

    this.#source_node.start(0, this.#paused_at);
    this.#started_at = this.#audio_ctx.currentTime - this.#paused_at;
    this.#paused_at = 0;
  }

  pause() {
    const elapsed = this.#audio_ctx.currentTime - this.#started_at;
    this.stop();
    this.#paused_at = elapsed;
    if (this.#listener) this.#listener("audiopause");
  }

  stop() {
    // this.#source_node.disconnect();
    this.#source_node.stop(0);
    this.#source_node = null;

    this.#paused_at = 0;
    this.#started_at = 0;
    this.is_playing = false;
  }

  get current_time() {
    return this.#audio_ctx.currentTime - this.#started_at;
  }

  get duration() {
    return this.#audio_buffer.duration;
  }

  get volume() {
    return this.#vol;
  }
  set volume(vol) {
    this.#vol = vol;
    if (this.active) this.#gainNode.gain.value = vol;
  }

  set active(value) {
    this.#is_active = value;

    if (!value) {
      this.#gainNode.gain.value = 0;
    } else {
      this.#gainNode.gain.value = this.#vol;
    }
  }
  get active() {
    return this.#is_active;
  }
}
