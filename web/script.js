import Engine from "./src/Engine.js";
import Scene from "./src/Scene.js";
import { vec3 } from "./src/math.js";
import InputController from "./src/InputController.js";
import Object3D from "./src/Object3D.js";

/**
 * ENGINE STUFF
 */
const engine = new Engine((e, data) => {});

/**
 *
 * SCENE STUFF
 */
class Demo extends Scene {
  #obj;

  x = -1;
  constructor() {
    super("demo");

    this.#obj = new Object3D("triangle");
    this.add_obj3d(this.#obj);
  }

  update(delta) {
    const t = Math.sin(this.x / 10);
    this.#obj.transform.position = vec3(0, 0, 10 + t * 3);
    this.#obj.transform.rotation = vec3(this.x + t, this.x + t, this.x + t);
    this.x -= 1;

    this.camera.position = vec3(0, 0, 0);
    this.camera.target = vec3(0, 0, 1);
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

  document.querySelector("#back").onclick = () => {
    engine.test();
  };
  const actionButton = document.querySelector("#play");
  actionButton.onclick = () => {
    if (engine.is_running !== null) {
      engine.stop();
      actionButton.innerText = "PLAY";
    } else {
      engine.play();
      actionButton.innerText = "STOP";
    }
  };

  document.addEventListener("wasm_info", (e) => {
    e.stopPropagation();
  });

  InputController.initialize();
  await engine.start_engine(Demo);

  // engine.play();
};
