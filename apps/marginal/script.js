import { Engine, InputController } from "gizmo";
import WorldMap from "./src/WorldMap.js";
import MarginalScene from "./src/MarginalScene.js";

const $ = (selector) => document.querySelector(selector);
const overlay = $("#overlay"), status = $("#status"), start = $("#start");
const speed = $("#speed"), hud = $("#hud");

const world = new WorldMap(await (await fetch("resources/world/map.json")).json());

let ready = false;
const engine = new Engine((state, data) => {
  switch (state) {
    case Engine.States.LOADING:
      status.textContent = "A carregar...";
      break;
    case Engine.States.READY:
      engine.playOnce(); // show the start line, still paused
      ready = true;
      status.textContent = "Marginal · EN6";
      start.hidden = false;
      break;
    case Engine.States.PLAYING:
      if (!engine.is_running) break; // playOnce
      overlay.classList.add("hidden");
      hud.hidden = false;
      break;
    case Engine.States.STOPPED:
      if (!ready) break;
      overlay.classList.remove("hidden");
      status.textContent = "Pausa";
      break;
    case Engine.States.RENDERED: {
      const car = engine.scene?.car;
      if (car) speed.textContent = Math.round(car.speed * 3.6);
      break;
    }
  }
});

// Any key starts; P pauses and resumes. Leaving the tab pauses.
document.addEventListener("keydown", (e) => {
  if (!ready || e.repeat) return;
  if (e.keyCode === InputController.Key.P && engine.is_running) engine.stop();
  else if (!engine.is_running) engine.play();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) engine.stop();
});

try {
  await engine.start_engine(class extends MarginalScene {
    constructor() {
      super(world);
    }
  }, { canvas: $("#screen canvas"), data: "resources/data.json" });
} catch (error) {
  console.error(error);
  status.textContent = `Erro: ${error.message}`;
}

// For the devtools console.
globalThis.marginal = { engine, world };
