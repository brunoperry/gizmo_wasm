import { InputController, vec3, smooth } from "gizmo";

// The driving camera. C switches between:
//   CHASE: behind and above the car, following its heading with a lag, so
//          turns and slides show;
//   HOOD:  at the driver's eye, looking where the car points.
// The field of view widens a little with speed.
export default class DriveCamera {
  static Modes = { CHASE: 0, HOOD: 1 };
  mode = DriveCamera.Modes.CHASE;

  chase = { distance: 6.8, height: 2.3, look_ahead: 2.5, look_height: 1.0, lag: 0.22, fov: 58 };
  hood = { forward: 1.25, height: 1.2, fov: 66 }; // bonnet camera: a strip of hood at the bottom
  fov_boost = 10; // extra degrees at top speed

  #camera;
  #car;
  #yaw; // the chase camera's heading (follows the car's)
  #pos = null; // smoothed chase position
  #c_down = false;

  constructor(camera, car) {
    this.#camera = camera;
    this.#car = car;
    this.snap();
  }

  // Puts the camera right where it should be (no glide), e.g. after a reset.
  snap() {
    this.#yaw = this.#car.heading;
    this.#pos = null;
  }

  update(delta) {
    const c_key = !!InputController.getKey(InputController.Key.C);
    if (c_key && !this.#c_down) {
      this.mode = this.mode === DriveCamera.Modes.CHASE ? DriveCamera.Modes.HOOD : DriveCamera.Modes.CHASE;
      this.snap();
    }
    this.#c_down = c_key;

    const car = this.#car, cam = this.#camera;
    const speed_t = Math.min(1, car.speed / car.top_speed);
    if (this.mode === DriveCamera.Modes.HOOD) {
      const f = car.forward;
      cam.position = vec3(car.x + f.x * this.hood.forward, this.hood.height, car.z + f.z * this.hood.forward);
      cam.set_angles(car.heading, -0.04);
      cam.fov = this.hood.fov + this.fov_boost * speed_t;
      return;
    }

    // Chase: the camera's heading glides towards the car's (shortest way round).
    const c = this.chase;
    let diff = car.heading - this.#yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.#yaw = smooth(this.#yaw, this.#yaw + diff, c.lag, delta);
    const sx = Math.sin(this.#yaw), sz = Math.cos(this.#yaw);
    const target = vec3(car.x - sx * c.distance, c.height, car.z - sz * c.distance);
    this.#pos = this.#pos
      ? vec3(smooth(this.#pos.x, target.x, 0.05, delta), smooth(this.#pos.y, target.y, 0.1, delta), smooth(this.#pos.z, target.z, 0.05, delta))
      : target;
    cam.position = this.#pos;

    const look = vec3(car.x + sx * c.look_ahead, c.look_height, car.z + sz * c.look_ahead);
    cam.direction = vec3(look.x - this.#pos.x, look.y - this.#pos.y, look.z - this.#pos.z);
    cam.fov = c.fov + this.fov_boost * speed_t;
  }
}
