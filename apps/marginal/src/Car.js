import { InputController, vec3 } from "gizmo";

const K = InputController.Key;
const key = (...codes) => (codes.some((c) => InputController.getKey(c)) ? 1 : 0);

// Arcade car on the flat ground plane. Heading: radians around y, 0 drives
// towards +z (as Camera3D's yaw and Object3D.rotation.y).
//
// Model: the velocity is split into forward and sideways parts relative to
// the car. The engine and brakes act on the forward part; tyre grip bleeds
// the sideways part away (less with the handbrake or off-road, so the car
// slides). Turning follows the front wheels (bicycle model).
export default class Car {
  // Tuning (SI units: metres, seconds, radians)
  static STEP = 1 / 120; // physics time step
  wheelbase = 2.62;
  top_speed = 58; // m/s (~210 km/h)
  accel = 7.5; // m/s² from standstill
  brake = 13;
  reverse_speed = 9;
  drag = 0.00045; // air: per (m/s)²
  rolling = 0.35; // m/s²
  max_steer = 0.6; // at walking pace; less at speed (steer_falloff)
  steer_falloff = 14; // m/s where max steer has halved
  steer_speed = 3.2; // rad/s the wheels turn
  grip = 9; // 1/s: how fast sideways speed is absorbed
  handbrake_grip = 1.2;
  offroad_grip = 4;
  offroad_drag = 3.5; // m/s² extra off the asphalt
  offroad_top_speed = 22;
  radius = 0.95; // collision circles at the front and back axles
  bounce = 0.25; // fraction of the speed into a wall that comes back

  x = 0;
  z = 0;
  heading = 0;
  forward_speed = 0; // m/s, along the heading
  side_speed = 0; // m/s, to the car's right
  steer = 0; // front wheel angle, radians (positive = left)
  on_road = true;
  impact = 0; // speed lost in the last hit (m/s), for effects

  #world;
  #objects;
  #time = 0;

  constructor(world, objects) {
    this.#world = world;
    this.#objects = objects;
    this.reset();
  }

  // Back to the start, standing still.
  reset() {
    const s = this.#world.spawn;
    this.x = s.x;
    this.z = s.z;
    this.heading = s.heading;
    this.forward_speed = this.side_speed = this.steer = 0;
    this.#write();
  }

  get speed() {
    return Math.hypot(this.forward_speed, this.side_speed);
  }
  get position() {
    return vec3(this.x, 0, this.z);
  }
  // Unit vector the car points to, on the ground.
  get forward() {
    return vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  update(delta) {
    this.#time += delta;
    while (this.#time >= Car.STEP) {
      this.#step(Car.STEP);
      this.#time -= Car.STEP;
    }
    this.#write();
  }

  #step(dt) {
    const throttle = key(K.UP, K.W);
    const braking = key(K.DOWN, K.S);
    const handbrake = key(K.SPACE);
    const steer_input = key(K.LEFT, K.A) - key(K.RIGHT, K.D);
    this.on_road = this.#world.on_road(this.x, this.z);

    // Steering: the wheels turn at a limited rate, less at speed.
    const v = this.forward_speed;
    const limit = this.max_steer / (1 + Math.abs(v) / this.steer_falloff);
    const target = steer_input * limit;
    const step = this.steer_speed * dt;
    this.steer += Math.max(-step, Math.min(step, target - this.steer));

    // Engine, brakes, reverse.
    const top = this.on_road ? this.top_speed : this.offroad_top_speed;
    let a = 0;
    if (throttle && v >= -0.5) a += this.accel * Math.max(0, 1 - v / top);
    if (braking) {
      if (v > 0.5) a -= this.brake;
      else a -= this.accel * 0.6 * Math.max(0, 1 + v / this.reverse_speed); // reverse
    }
    if (throttle && v < -0.5) a += this.brake; // braking out of reverse
    if (handbrake) a -= Math.sign(v) * Math.min(Math.abs(v) / dt, 6);

    // Resistance always opposes the motion and never reverses it.
    const resist = this.rolling + this.drag * v * v + (this.on_road ? 0 : this.offroad_drag);
    const after = v + a * dt;
    const slowed = Math.abs(after) - resist * dt;
    this.forward_speed = slowed > 0 ? Math.sign(after) * slowed : (throttle || braking) && !handbrake ? after : 0;

    // Turning: bicycle model on the forward speed. The velocity keeps its
    // direction while the car turns under it: that shows up as sideways
    // speed, which grip then absorbs (or not: a slide).
    let { vx, vz } = this.#velocity();
    this.heading += ((this.forward_speed * Math.tan(this.steer)) / this.wheelbase) * dt;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.#set_velocity(vx, vz);
    const grip = handbrake ? this.handbrake_grip : this.on_road ? this.grip : this.offroad_grip;
    const kept = Math.exp(-grip * dt);
    // Some of the absorbed sideways speed carries on forward (arcade momentum).
    const lost = this.side_speed * (1 - kept);
    this.side_speed *= kept;
    this.forward_speed += Math.sign(this.forward_speed) * Math.abs(lost) * 0.3;

    ({ vx, vz } = this.#velocity());
    this.x += vx * dt;
    this.z += vz * dt;

    this.#collide(fx, fz, vx, vz);
  }

  #collide(fx, fz, vx, vz) {
    this.impact = 0;
    const axle = this.wheelbase / 2;
    for (const side of [1, -1]) {
      const cx = this.x + fx * axle * side, cz = this.z + fz * axle * side;
      const hit = this.#world.collide(cx, cz, this.radius);
      if (!hit) continue;
      this.x += hit.x;
      this.z += hit.z;
      // Remove (and bounce back a little of) the speed into the wall; scrape
      // some of the speed along it.
      const into = vx * hit.nx + vz * hit.nz;
      if (into < 0) {
        vx -= (1 + this.bounce) * into * hit.nx;
        vz -= (1 + this.bounce) * into * hit.nz;
        vx *= 0.85;
        vz *= 0.85;
        this.impact = Math.max(this.impact, -into);
        // A hit off the car's axis turns it (torque around the centre).
        this.heading += side * -into * 0.008 * (fz * hit.nx - fx * hit.nz);
      }
    }
    if (this.impact > 0) this.#set_velocity(vx, vz);
  }

  // World velocity from the car-relative speeds. The car's right is
  // forward x up = (-cos h, 0, sin h).
  #velocity() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    return {
      vx: fx * this.forward_speed - fz * this.side_speed,
      vz: fz * this.forward_speed + fx * this.side_speed,
    };
  }
  #set_velocity(vx, vz) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.forward_speed = vx * fx + vz * fz;
    this.side_speed = -vx * fz + vz * fx;
  }

  // Moves the car's meshes to the simulated pose.
  #write() {
    const rotation = vec3(0, (this.heading * 180) / Math.PI, 0);
    for (const obj of this.#objects) {
      obj.position = vec3(this.x, 0, this.z);
      obj.rotation = rotation;
    }
  }
}
