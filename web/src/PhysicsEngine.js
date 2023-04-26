import { vec3, vec3_scale } from "./math.js";

export default class PhysicsSystem {
  constructor() {
    this.objects = [];
    this.gravity = vec3(0, -9.81, 0); // Earth's gravity in m/s^2
  }

  add(obj3d) {
    this.objects.push(obj3d);
  }

  remove(object) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }
  }

  step(dt) {
    // Apply external forces to each object
    this.objects.forEach((obj) => {
      obj.addForce(vec3_scale(this.gravity, obj.mass));
    });

    // Integrate each object forward in time
    this.objects.forEach((obj) => {
      obj.integrate(dt);
    });
  }
}
