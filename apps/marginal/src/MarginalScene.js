import { Light3D, Resources, Scene, InputController, vec3 } from "gizmo";
import Car from "./Car.js";
import DriveCamera from "./DriveCamera.js";

// Free driving on the Marginal: the world (tools/build_world.mjs), the car,
// a sunny afternoon over the Tagus.
export default class MarginalScene extends Scene {
  static VIEW_DISTANCE = 380; // metres: fog ends and the camera's far plane
  static SHADOW_DISTANCE = 70; // metres around the camera that get shadows

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
    // Its shadow map follows the camera: sharp shadows nearby, none far away.
    this.sun = new Light3D({
      direction: vec3(0.45, -0.75, -0.5), color: "#fff1dc", intensity: 0.78,
      shadow_distance: MarginalScene.SHADOW_DISTANCE,
    });
    this.add_light(this.sun);

    // Only what stands on the ground casts shadows (the "solid" meshes:
    // buildings, walls). The ground and the roads have nothing under them
    // to shade, and leaving them out of the shadow map is much faster.
    for (const obj of Resources.get_objects("world")) {
      obj.cast_shadows = obj.name.startsWith("solid");
      this.add_obj3d(obj);
    }
    const car_objects = Resources.get_objects("car");
    for (const obj of car_objects) this.add_obj3d(obj);

    this.camera.z_near = 0.1;
    this.camera.z_far = MarginalScene.VIEW_DISTANCE;
    this.car = new Car(world, car_objects);
    this.drive_camera = new DriveCamera(this.camera, this.car, world);
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
