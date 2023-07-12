import Resources from "./Resources.js";
import WASM from "./WASM.js";
import { vec3, vec3_add, vec3_mul_scalar, vec3_sub } from "./math.js";

export default class Car {
  obj3d;
  engineForce = 0.4;
  constructor(type = "visa") {
    this.obj3d = Resources.get_object(type);
    WASM.set_object_buffer(this.obj3d);

    this.velocity = vec3();

    this.angle = 0;
    this.angularVelocity = 0;
    this.maxSpeed = 5;
    this.acceleration = 0.001;
    this.braking = 0.2;
    this.turningAbility = 0.05;
    this.friction = 0.05;
    this.drag = 0.001;
  }

  update() {
    // Apply friction and drag
    this.applyFriction();
    this.applyDrag();

    // Update position based on velocity
    this.position = vec3_add(this.position, this.velocity);

    this.rotation = vec3(
      this.rotation.x,
      this.angle * this.acceleration + this.angle,
      this.rotation.z
    );

    this.angle += this.angularVelocity;
  }

  applyFriction() {
    this.velocity = vec3_sub(
      this.velocity,
      vec3_mul_scalar(this.velocity, this.friction)
    );
  }
  applyDrag() {
    this.velocity = vec3_sub(this.velocity, vec3_mul_scalar(this.velocity, this.drag));
  }

  accelerate() {
    // const rotY = this.rotation.y;
    this.velocity.z += Math.cos(this.angle) * this.acceleration;
    this.velocity.x += Math.sin(this.angle) * this.acceleration;

    // Limit speed
    this.limitSpeed();
  }
  brake() {
    // const rotY = this.rotation.y;

    this.velocity.z -= Math.cos(this.angle) * this.acceleration;
    this.velocity.x -= Math.sin(this.angle) * this.acceleration;
  }

  turnLeft() {
    this.angularVelocity = this.turningAbility;
  }
  turnRight() {
    this.angularVelocity = -this.turningAbility;
  }
  releaseSteering() {
    this.angularVelocity = 0;
  }

  limitSpeed() {
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (speed > this.maxSpeed) {
      const factor = this.maxSpeed / speed;
      this.velocity.x *= factor;
      this.velocity.y *= factor;
      this.velocity.z *= factor;
    }
  }

  set position(pos) {
    this.obj3d.position = pos;
  }
  get position() {
    return this.obj3d.position;
  }

  set rotation(rot) {
    this.obj3d.rotation = rot;
  }
  get rotation() {
    return this.obj3d.rotation;
  }
}
