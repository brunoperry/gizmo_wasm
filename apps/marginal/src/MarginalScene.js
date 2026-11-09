import { Light3D, Resources, Scene, InputController, vec3 } from "gizmo";
import Car from "./Car.js";
import DriveCamera from "./DriveCamera.js";

// Free driving on the Marginal: the world (tools/build_world.mjs), the car,
// a sunny afternoon over the Tagus.
export default class MarginalScene extends Scene {
  static VIEW_DISTANCE = 380; // metres: fog ends and the camera's far plane

  car;
  drive_camera;
  #r_down = false;

  // world: a WorldMap (map.json)
  constructor(world) {
    super("Marginal", { default_light: false });
    this.world = world;

    this.sky = "#a8c4da";
    this.fog = { near: 140, far: MarginalScene.VIEW_DISTANCE };
    this.ambient = [0.42, 0.44, 0.48];
    // Afternoon sun from the south-west (over the river).
    this.sun = new Light3D({ direction: vec3(0.45, -0.75, -0.5), color: "#fff1dc", intensity: 0.78 });
    this.add_light(this.sun);

    for (const obj of Resources.get_objects("world")) this.add_obj3d(obj);
    const car_objects = Resources.get_objects("car");
    for (const obj of car_objects) this.add_obj3d(obj);

    this.camera.z_near = 0.1;
    this.camera.z_far = MarginalScene.VIEW_DISTANCE;
    this.car = new Car(world, car_objects);
    this.drive_camera = new DriveCamera(this.camera, this.car);
    this.drive_camera.update(0);
  }

  update(delta) {
    // R: back to the start.
    const r_key = !!InputController.getKey(InputController.Key.R);
    if (r_key && !this.#r_down) {
      this.car.reset();
      this.drive_camera.snap();
    }
    this.#r_down = r_key;

    this.car.update(delta);
    this.drive_camera.update(delta);
    super.update(delta);
  }
}
