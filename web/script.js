import Resources from "./src/Resources.js";
import Engine from "./src/Engine.js";
import Scene from "./src/Scene.js";
import { vec3 } from "./src/math.js";

/**
 * ENGINE STUFF
 */
const engine = new Engine((e, data) => {});

/**
 *
 * SCENE STUFF
 */
class Demo extends Scene {
  #obj1;

  x = -1;
  constructor() {
    super("demo");

    this.#obj1 = Resources.get_object("cube");
    this.add_obj3d(this.#obj1);
  }

  update(delta) {
    this.#obj1.transform.position = vec3(Math.sin(this.x / 50), 0, 20);
    this.#obj1.transform.rotation = vec3(this.x, this.x, 0);
    this.x -= 1;
    this.camera.position = vec3(0, 0, -2);
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
    // ui.update({
    //   fps: engine.fps,
    //   verts: e.detail.verts,
    //   tris: e.detail.tris,
    // });
    e.stopPropagation();
  });

  await engine.start_engine(Demo);

  // engine.play();
};
