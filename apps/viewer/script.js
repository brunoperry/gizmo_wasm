import { Engine, FlyControls, Resources } from "gizmo";
import { UI } from "./src/UI.js";
import TestScene from "./src/TestScene.js";
import ModelScene from "./src/ModelScene.js";

window.onload = async () => {
  /**
   * UI STUFF
   */
  const ui = new UI((e) => {
    switch (e.action) {
      case UI.Actions.PLAY_PAUSE:
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
        load(e.mesh, () => load_model(e.mesh));
        break;
      case UI.Actions.OPEN_FILES:
        load(e.files.map((f) => f.name).join(", "), async () => {
          for (const warning of await open_files(e.files)) ui.log_error(warning);
        });
        break;
      case UI.Actions.GRID:
        engine.show_grid = !engine.show_grid;
        break;
      case UI.Actions.HUD:
        update_hud(); // show the current values right away, even while paused
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
      case Engine.States.RENDERED:
        frame_info = data;
        update_hud();
        break;
      case Engine.States.SCENE_CHANGED:
        fly(data);
        ui.set_scene(data.entry ?? null);
        update_hud();
        ui.log_console(`Loaded ${data.name}.`);
        break;
      case Engine.States.DISPLAY_CHANGED:
        ui.set_grid(engine.show_grid);
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
        fly(engine.scene);
        engine.show_grid = true;
        ui.enable();
        ui.set_lighting(engine.lighting_mode, engine.show_light_gizmos, engine.shadows);
        ui.set_grid(engine.show_grid);
        update_hud();
        ui.log_console(data);
        break;
    }
  });
  // A model from data.json (Scene > Models), by its entry name: downloaded
  // the first time it's picked; the current scene stays until it's ready.
  const load_model = async (name) => {
    await Resources.load_model(name);
    engine.load_scene(() => new ModelScene(name, Resources.get_objects(name), name));
  };
  // A model picked from the computer, with its textures (see
  // Resources.load_files). Returns the loader's warnings.
  const open_files = async (files) => {
    const model = await Resources.load_files(files);
    engine.load_scene(() => new ModelScene(model.name, model.objects));
    return model.warnings;
  };

  // Loads one scene at a time; errors go to the console bar.
  let busy = false;
  const load = async (what, task) => {
    if (busy) return;
    busy = true;
    ui.log_console(`Loading ${what}...`);
    try {
      await task();
    } catch (error) {
      console.error(error);
      ui.log_error(error.message);
    } finally {
      busy = false;
    }
  };

  // Every scene gets the editor-like camera: mouse look, W A S D, F.
  const fly = (scene) => (scene.controls ??= new FlyControls(scene.camera));

  // HUD: refreshed on every rendered frame (RENDERED gives the counts).
  let frame_info = null;
  const update_hud = () => {
    if (!ui.hud_visible) return;
    const camera = engine.camera;
    ui.update_hud({
      scene: engine.scene_name ?? "-",
      fps: engine.fps,
      verts: frame_info?.verts,
      tris: frame_info?.tris,
      mem: engine.memory,
      cam_pos: camera?.position,
      cam_rot: camera?.rotation,
    });
  };

  if (check_mobile()) {
    ui.log_error("No mobile support :(");
    return;
  }
  await engine.start_engine(TestScene, {
    canvas: document.querySelector("#canvas-container > canvas"),
    data: "resources/data.json",
    pointer_lock: true,
  });
  ui.start_ui();
};
const check_mobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};
