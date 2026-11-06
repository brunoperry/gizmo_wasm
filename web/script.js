import Engine from "./src/Engine.js";
import { UI } from "./src/UI.js";
import TestScene from "./src/TestScene.js";

window.onload = async () => {
  /**
   * UI STUFF
   */
  const ui = new UI((e) => {
    switch (e.action) {
      case UI.Actions.PLAY_PAUSE:
        engine.unlock = true;
        engine.is_running ? engine.stop() : engine.play();
        break;
      case UI.Actions.NEXT:
        engine.playOnce();
        break;
      case UI.Actions.RENDER_MODE:
        engine.render_mode = e.mode;
        break;
      case UI.Actions.LIGHTING_MODE:
        engine.lighting_mode = e.mode;
        break;
      case UI.Actions.LIGHT_GIZMOS:
        engine.show_light_gizmos = !engine.show_light_gizmos;
        break;
      case UI.Actions.SHADOWS:
        engine.shadows = !engine.shadows;
        break;
      case UI.Actions.FILTER:
        engine.applyFilter(e.filter);
        break;
      case UI.Actions.GET_AUDIO:
        ui.setAudio(engine.getAudioTrack(e.index));
        break;
      case UI.Actions.MESH:
        console.log(e);
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
      case Engine.States.LIGHTING_CHANGED:
        ui.set_lighting(engine.lighting_mode, engine.show_light_gizmos, engine.shadows);
        break;
      case Engine.States.FILTER_CHANGED:
        ui.set_filter(data);
        break;
      case Engine.States.MODE_CHANGED:
        ui.set_render_mode(engine.render_mode);
        break;
      case Engine.States.LOADING:
        ui.log_console(data);
        break;
      case Engine.States.READY:
        ui.enable();
        ui.set_scene_name(engine.scene_name);
        ui.set_lighting(engine.lighting_mode, engine.show_light_gizmos, engine.shadows);
        ui.set_scene_memory(engine.memory);
        ui.log_console(data);
        break;
    }
  });
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

  await engine.start_engine(TestScene);
  ui.start_ui();
};
const check_mobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};
