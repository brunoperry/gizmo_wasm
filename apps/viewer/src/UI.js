import { Display, Resources } from "gizmo";
import "./GizmoMenu.js"; // <gizmo-menubar>, <gizmo-menu>, <gizmo-menu-item>

export class UI {
  static Actions = {
    PLAY_PAUSE: "playpause",
    NEXT: "next",
    RENDER_MODE: "rendermode",
    FILTER: "filter",
    LIGHTING_MODE: "lightingmode",
    LIGHT_GIZMOS: "lightgizmos",
    SHADOWS: "shadows",
    GET_AUDIO: "getaudio",
    MESH: "mesh",
    GRID: "grid",
    HUD: "hud",
    OPEN_FILES: "openfiles",
  };
  #listener = null;

  #menu = null;
  #controls = null;

  #play_pause_btn = null;
  #next_btn = null;
  // Shading > Textured is remembered while wireframe is on (it's disabled then).
  #textured = true;

  #console = null;
  #logs = null;

  // Display > HUD: scene, frame and camera info over the view.
  #hud = null;
  #hud_fields = null;
  #hud_visible = false;

  #file_input = null;

  #is_ready = false;
  #is_console_open = false;

  #freqCanvas;
  #currentTrack;

  constructor(listener) {
    this.#listener = listener;
    this.#setupUI();
  }

  enable() {
    this.#menu.className = "";
    this.#controls.className = "";
    this.#show_hud(this.#hud_visible);
    this.finishUI();
  }

  disable() {
    this.#menu.className = "invisible";
    this.#controls.className = "invisible";
    this.#hud.classList.add("hidden");
  }

  // Lists the models in Scene > Models (value: the data.json entry name).
  start_ui() {
    const models = this.#menu.querySelector("#menu-models");
    for (const mesh of Resources.DATA.meshes) {
      const item = document.createElement("gizmo-menu-item");
      item.type = "radio";
      item.name = "model";
      item.value = mesh.name;
      item.textContent = mesh.name;
      models.appendChild(item);
    }
  }

  // A scene was loaded: checks its model in Scene > Models (model = the
  // data.json entry, null for other scenes, e.g. a file from the computer).
  set_scene(model) {
    for (const item of this.#menu_items("model")) item.checked = item.value === model;
    this.#check_is_ready();
  }

  #setupUI() {
    this.#menu = document.querySelector("#menu");
    this.#controls = document.querySelector("#controls");

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

    this.#console = document.querySelector("#console");
    this.#console.onclick = () => {
      !this.#is_console_open ? this.#open_console() : this.#close_console();
    };
    this.#logs = document.querySelector("#logs");

    this.#hud = document.querySelector("#hud");
    const field = (id) => this.#hud.querySelector(`#hud-${id}`);
    this.#hud_fields = {
      scene: field("scene"),
      fps: field("fps"),
      verts: field("verts"),
      tris: field("tris"),
      mem: field("mem"),
      cam_pos: field("cam-pos"),
      cam_rot: field("cam-rot"),
    };

    this.#menu.addEventListener("menuselect", (e) => this.#on_menu(e.detail));

    // Scene > Open file... and files dropped on the view.
    this.#file_input = document.querySelector("#open-file");
    this.#file_input.onchange = () => {
      const files = [...this.#file_input.files];
      this.#file_input.value = ""; // picking the same files again still fires
      if (files.length) this.#listener({ action: UI.Actions.OPEN_FILES, files });
    };
    const view = document.querySelector("#canvas-container");
    view.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      view.classList.add("dropping");
    });
    view.addEventListener("dragleave", (e) => {
      if (!view.contains(e.relatedTarget)) view.classList.remove("dropping");
    });
    view.addEventListener("drop", (e) => {
      e.preventDefault();
      view.classList.remove("dropping");
      const files = [...e.dataTransfer.files];
      if (files.length && !this.#menu.classList.contains("invisible")) {
        this.#listener({ action: UI.Actions.OPEN_FILES, files });
      }
    });
  }

  #on_menu({ name, value, checked }) {
    if (this.#is_console_open) this.#close_console();
    switch (name) {
      case "model":
        this.#listener({ action: UI.Actions.MESH, mesh: value });
        break;
      case "open":
        this.#file_input.click(); // still inside the click/key event, as browsers require
        break;
      case "lighting-mode":
        this.#listener({ action: UI.Actions.LIGHTING_MODE, mode: Display.LightingModes[value] });
        break;
      case "wireframe":
        this.#listener({ action: UI.Actions.RENDER_MODE, mode: checked ? Display.RenderModes.WIRED : this.#solid_mode() });
        break;
      case "textured":
        this.#textured = checked;
        this.#listener({ action: UI.Actions.RENDER_MODE, mode: this.#solid_mode() });
        break;
      case "lights":
        this.#listener({ action: UI.Actions.LIGHT_GIZMOS });
        break;
      case "shadows":
        this.#listener({ action: UI.Actions.SHADOWS });
        break;
      case "filter":
        this.#listener({ action: UI.Actions.FILTER, filter: value });
        break;
      case "grid":
        this.#listener({ action: UI.Actions.GRID });
        break;
      case "hud":
        this.#show_hud(checked);
        this.#listener({ action: UI.Actions.HUD, visible: checked });
        break;
    }
  }
  #solid_mode() {
    return this.#textured ? Display.RenderModes.TEXTURED : Display.RenderModes.SHADED;
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

  // Menu check marks follow the engine's state.
  #menu_items(name) {
    return this.#menu.querySelectorAll(`gizmo-menu-item[name="${name}"]`);
  }
  #check(name, checked) {
    for (const item of this.#menu_items(name)) item.checked = checked;
  }

  set_grid(show_grid) {
    this.#check("grid", show_grid);
  }

  get hud_visible() {
    return this.#hud_visible;
  }
  #show_hud(visible) {
    this.#hud_visible = visible;
    this.#hud.classList.toggle("hidden", !visible);
    this.#check("hud", visible);
  }
  // Called every frame while the HUD is visible: only touches the text that
  // changed (writing text forces style/layout work).
  update_hud({ scene, fps, verts, tris, mem, cam_pos, cam_rot }) {
    const f = this.#hud_fields;
    UI.#set_text(f.scene, scene);
    UI.#set_text(f.fps, fps);
    UI.#set_text(f.verts, verts ?? "-");
    UI.#set_text(f.tris, tris ?? "-");
    UI.#set_text(f.mem, `~${Math.round(mem / 1000 / 1000)}mb`);
    UI.#set_text(f.cam_pos, cam_pos ? UI.#vec(cam_pos, 2) : "-");
    UI.#set_text(f.cam_rot, cam_rot ? UI.#vec(cam_rot, 1) : "-");
  }
  // Fixed-width columns so the numbers don't jump around.
  static #vec(v, decimals) {
    const n = (x) => (Math.abs(x) < 0.5 * 10 ** -decimals ? 0 : x).toFixed(decimals).padStart(7);
    return `${n(v.x)} ${n(v.y)} ${n(v.z)}`;
  }
  static #set_text(element, value) {
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
  }

  set_lighting(mode, show_gizmos, shadows) {
    for (const item of this.#menu_items("lighting-mode")) item.checked = Display.LightingModes[item.value] === mode;
    this.#check("lights", show_gizmos);
    this.#check("shadows", shadows);
  }

  // Checks the filter that is applied to every frame (null = none).
  set_filter(filter) {
    for (const item of this.#menu_items("filter")) item.checked = item.value === filter;
    this.log_console(filter ? `Filter: ${filter}.` : "Filter off.");
  }

  set_render_mode(mode) {
    const wired = mode === Display.RenderModes.WIRED;
    if (!wired) this.#textured = mode === Display.RenderModes.TEXTURED;
    this.#check("wireframe", wired);
    this.#check("textured", this.#textured);
    for (const item of this.#menu_items("textured")) item.disabled = wired;

    this.#check_is_ready();
    switch (mode) {
      case Display.RenderModes.WIRED:
        this.log_console("Wireframed.");
        break;
      case Display.RenderModes.SHADED:
        this.log_console("Shaded.");
        break;
      case Display.RenderModes.TEXTURED:
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
