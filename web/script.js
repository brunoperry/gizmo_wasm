import Resources from "./src/Resources.js";
import Engine from "./src/Engine.js";
import Scene from "./src/Scene.js";
import { UI } from "./src/UI.js";

/**
 * UI STUFF
 */
const ui = new UI((e) => {
  switch (e.action) {
    case UI.Actions.PLAY_PAUSE:
      engine.unlock = true;
      engine.is_running ? engine.stop() : engine.play();
      break;
    case UI.Actions.RENDER_MODE:
      engine.render_mode = e.mode;
      break;
  }
});
/**
 * ENGINE STUFF
 */
const engine = new Engine((e, data) => {
  switch (e) {
    case Engine.States.PLAYING:
      ui.set_playpause(true);
      break;
    case Engine.States.STOPPED:
      ui.set_playpause(false);
      break;
    case Engine.States.MODE_CHANGED:
      ui.set_render_mode(engine.render_mode);
      break;
    case Engine.States.LOADING:
      ui.log_console(data);
      break;
    case Engine.States.READY:
      ui.enable();
      ui.set_scene_name(engine.scene_name, "Noite da Mosca");
      ui.set_scene_memory(engine.memory);
      ui.log_console(data);
      break;
  }
});

/**
 *
 * SCENE STUFF
 */
class Demo extends Scene {
  #obj1;
  #obj2;
  constructor() {
    super("demo");

    this.#obj1 = Resources.get_object("floor");
    // this.#obj2 = Resources.get_object("road");

    this.add_obj3d(this.#obj1);

    this.player.add_collider(this.#obj1);
    // this.add_obj3d(this.#obj2);
  }

  update(delta) {
    super.update(delta);
  }
}

const check_mobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};
window.onload = async () => {
  if (check_mobile()) {
    ui.log_error("No mobile support :(");
    return;
  }
  document.addEventListener("wasm_info", (e) => {
    ui.update({
      fps: engine.fps,
      verts: e.detail.verts,
      tris: e.detail.tris,
    });
    e.stopPropagation();
  });

  await engine.start_engine(Demo);
};
