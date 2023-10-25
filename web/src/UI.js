import Display from "./Display.js";
import Resources from "./Resources.js";

export class UI {
  static Actions = {
    PLAY_PAUSE: "playpause",
    NEXT: "next",
    RENDER_MODE: "rendermode",
    FILTER: "filter",
    GET_AUDIO: "getaudio",
  };
  #listener = null;

  #hud = null;
  #controls = null;

  #scene_label = null;
  #fps_label = null;
  #tris_label = null;
  #verts_label = null;
  #mem_label = null;

  #play_pause_btn = null;
  #next_btn = null;
  #wireframe_btn = null;
  #shaded_btn = null;
  #textured_btn = null;

  #console = null;
  #logs = null;

  #is_ready = false;
  #is_console_open = false;

  #freqCanvas;
  #currentTrack;

  constructor(listener) {
    this.#listener = listener;

    this.#setupUI();
  }

  enable() {
    this.#hud.className = "";
    this.#controls.className = "";
    this.finishUI();
  }

  disable() {
    this.#hud.className = "invisible";
    this.#controls.className = "invisible";
  }

  #setupUI() {
    this.#hud = document.querySelector("#hud");
    this.#controls = document.querySelector("#controls");

    this.#scene_label = document.querySelector("#scene").querySelector("span");
    this.#fps_label = document.querySelector("#fps");
    this.#verts_label = document.querySelector("#verts");
    this.#tris_label = document.querySelector("#tris");
    this.#mem_label = document.querySelector("#mem");

    this.#play_pause_btn = document.querySelector("#playpause");
    this.#play_pause_btn.onclick = () => {
      if (this.#is_console_open) this.#close_console();
      this.#listener({
        action: UI.Actions.PLAY_PAUSE,
      });
    };

    this.#next_btn = document.querySelector("#next");
    this.#next_btn.onclick = () => {
      this.#listener({
        action: UI.Actions.NEXT,
      });
    };

    this.#wireframe_btn = document.querySelector("#wireframe");
    this.#wireframe_btn.onclick = () => {
      if (this.#is_console_open) this.#close_console();
      this.#listener({
        action: UI.Actions.RENDER_MODE,
        mode: Display.RenderModes.WIRED,
      });
    };

    this.#shaded_btn = document.querySelector("#shaded");
    this.#shaded_btn.onclick = () => {
      if (this.#is_console_open) this.#close_console();
      this.#listener({
        action: UI.Actions.RENDER_MODE,
        mode: Display.RenderModes.SHADED,
      });
    };

    this.#textured_btn = document.querySelector("#textured");
    this.#textured_btn.onclick = () => {
      if (this.#is_console_open) this.#close_console();
      this.#listener({
        action: UI.Actions.RENDER_MODE,
        mode: Display.RenderModes.TEXTURED,
      });
    };

    this.#console = document.querySelector("#console");
    this.#console.onclick = () => {
      !this.#is_console_open ? this.#open_console() : this.#close_console();
    };
    this.#logs = document.querySelector("#logs");

    const filters = document.querySelector("#filters");
    filters.querySelector("#barrel").onclick = () => {
      this.#listener({
        action: UI.Actions.FILTER,
        filter: "barrel",
      });
    };
    filters.querySelector("#fisheye").onclick = () => {
      this.#listener({
        action: UI.Actions.FILTER,
        filter: "fisheye",
      });
    };
  }
  finishUI() {
    this.#freqCanvas = document.querySelector("#freqs").querySelector("canvas");
    const tracks = document.querySelector("#tracks");

    let currentTrack = 0;
    Resources.audios.forEach((audio, index) => {
      const btn = document.createElement("button");
      btn.innerText = `track ${audio.name}`;
      btn.onclick = () => {
        tracks.children[currentTrack].className = "";
        currentTrack = index;
        tracks.children[currentTrack].className = "toggle";
        this.#listener({
          action: UI.Actions.GET_AUDIO,
          index: 0,
        });
      };
      if (index === currentTrack) {
        btn.className = "toggle";
      }
      tracks.appendChild(btn);
    });
  }
  setAudio(audioTrack) {
    // console.log(audioTrack);
    this.#currentTrack = audioTrack;
  }
  updateFreqCanvas() {
    // console.log(this.#currentTrack.get_frequency(0));
  }

  log_console(value, color = "var(--color-d)") {
    const span = document.createElement("span");
    span.innerText = value;
    span.style.color = color;
    this.#logs.prepend(span);
  }
  log_error(message) {
    this.log_console(message, "var(--red)");
  }

  set_render_mode(mode) {
    this.#wireframe_btn.className = "";
    this.#shaded_btn.className = "";
    this.#textured_btn.className = "";

    this.#check_is_ready();
    switch (mode) {
      case Display.RenderModes.WIRED:
        this.#wireframe_btn.className = "toggled";
        this.log_console("Wireframed.");
        break;
      case Display.RenderModes.SHADED:
        this.#shaded_btn.className = "toggled";
        this.log_console("Shaded.");
        break;
      case Display.RenderModes.TEXTURED:
        this.#textured_btn.className = "toggled";
        this.log_console("Textured.");
        break;
    }
  }
  set_playpause(is_playing) {
    this.#check_is_ready();

    document.querySelector("canvas").style.backgroundImage = "none";

    const play_icon = document.querySelector("#icon-play");
    const pause_icon = document.querySelector("#icon-pause");
    play_icon.style.display = "none";
    pause_icon.style.display = "none";
    if (is_playing) {
      pause_icon.style.display = "initial";
      this.#play_pause_btn.className = "toggled-red";
      this.log_console("Playing... use mouse and WASD, (esc) to exit.");
    } else {
      play_icon.style.display = "initial";
      this.#play_pause_btn.className = "";
      this.log_console("Stopped.");
    }
  }

  update(data) {
    this.#fps_label.innerText = data.fps;
    this.#verts_label.innerText = data.verts;
    this.#tris_label.innerText = data.tris;

    this.updateFreqCanvas();
  }

  set_scene_name(name, subtitle = null) {
    this.#scene_label.innerText = name;

    if (subtitle) {
      const sub = document.createElement("span");
      sub.className = "sub";
      sub.innerText = ` (${subtitle})`;
      this.#scene_label.appendChild(sub);
    }
  }
  set_scene_memory(mem) {
    this.#mem_label.innerText = `~${Math.round(mem / 1000 / 1000)}mb`;
  }

  #check_is_ready() {
    if (!this.#is_ready) {
      const cnvs = document.querySelector("canvas");
      cnvs.style.backgroundImage = "none";
      cnvs.style.backgroundColor = "var(--color-b)";
      this.#is_ready = true;
    }
  }

  #open_console() {
    this.#console.style.overflow = "initial";
    this.#logs.style.overflowY = "auto";
    this.#is_console_open = true;
  }
  #close_console() {
    this.#console.style.overflow = "hidden";
    this.#logs.style.overflowY = "hidden";
    this.#is_console_open = false;
  }
}
