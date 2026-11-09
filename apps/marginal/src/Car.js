import { InputController, vec3 } from "gizmo";

const K = InputController.Key;
const key = (...codes) => (codes.some((c) => InputController.getKey(c)) ? 1 : 0);
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const G = 9.81;

// Where the wheels are in the car's model (as in tools/build_car.mjs):
// [x (the car's left), z (forward)] of each wheel's centre, and its radius.
const WHEEL_X = 0.8, WHEEL_Z = 1.31, WHEEL_RADIUS = 0.34;
const WHEELS = [
  { name: "wheel_fl", x: WHEEL_X, z: WHEEL_Z, front: true },
  { name: "wheel_fr", x: -WHEEL_X, z: WHEEL_Z, front: true },
  { name: "wheel_rl", x: WHEEL_X, z: -WHEEL_Z, front: false },
  { name: "wheel_rr", x: -WHEEL_X, z: -WHEEL_Z, front: false },
];

// 3x3 rotations (rows), as the engine's: p' = M · p.
const rot_x = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const rot_y = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const rot_z = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const mul = (a, b) => a.map((row) => [0, 1, 2].map((c) => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c]));
// The Object3D.rotation (degrees) that gives rotation matrix m: the engine
// builds Rx · Ry · Rz from it.
function euler(m) {
  const deg = 180 / Math.PI;
  if (Math.abs(m[0][2]) > 0.999999) // facing along x: Rx and Rz turn the same way; leave Rz out
    return vec3(Math.atan2(m[2][1], m[1][1]) * deg, Math.sign(m[0][2]) * 90, 0);
  return vec3(Math.atan2(-m[1][2], m[2][2]) * deg, Math.asin(m[0][2]) * deg, Math.atan2(-m[0][1], m[0][0]) * deg);
}

// A mass on a spring: `value` follows `target`, overshoots and settles.
// Its damping works against the speed relative to `target_speed`.
class Spring {
  value = 0;
  speed = 0;
  constructor(frequency, damping) {
    this.w = 2 * Math.PI * frequency;
    this.damping = damping;
  }
  set(value) {
    this.value = value;
    this.speed = 0;
  }
  step(dt, target, target_speed = 0) {
    this.speed += (-this.w * this.w * (this.value - target) - 2 * this.damping * this.w * (this.speed - target_speed)) * dt;
    this.value += this.speed * dt;
  }
  // Keeps the value within `travel` of `rest`, as a bump stop does.
  limit(rest, travel, rest_speed = 0) {
    if (Math.abs(this.value - rest) <= travel) return;
    this.value = rest + Math.sign(this.value - rest) * travel;
    this.speed = rest_speed;
  }
}

// Arcade car. Heading: radians around y, 0 drives towards +z (as Camera3D's
// yaw and Object3D.rotation.y).
//
// Driving is simulated seen from above: the velocity is split into forward
// and sideways parts relative to the car. The engine and brakes act on the
// forward part; the tyres absorb the sideways part, up to the grip they
// have (less with the handbrake, off-road, or braking hard: then the car
// slides). The car turns with its front wheels (bicycle model), as fast as
// the grip lets it at that speed, so it runs wide when it is too fast.
//
// The car's height comes from the ground under its wheels. On top of that
// the body is a mass on springs: it leans out of the turns, dives when
// braking, squats when accelerating and bounces over the bumps. This is
// only for show (it doesn't change how the car drives).
export default class Car {
  // Tuning (SI units: metres, seconds, radians)
  static STEP = 1 / 120; // physics time step
  wheelbase = WHEEL_Z * 2;
  top_speed = 58; // m/s (~210 km/h)
  accel = 7.5; // m/s² from standstill
  brake = 13;
  reverse_speed = 9;
  drag = 0.00045; // air: per (m/s)²
  rolling = 0.35; // m/s²
  hold = 1.5; // m/s² extra below hold_speed with no pedal: parked on a slope
  hold_speed = 0.4;
  max_steer = 0.6; // at walking pace; less at speed (steer_falloff)
  steer_falloff = 14; // m/s where max steer has halved
  steer_speed = 3.2; // rad/s the wheels turn
  turn_lag = 0.08; // s the car takes to answer the wheels
  cornering = 13; // m/s²: the fastest the tyres can turn the car (sideways acceleration)
  offroad_cornering = 7;
  grip = 9; // 1/s: how fast sideways speed is absorbed...
  slide = 1.2; // ...up to cornering * slide m/s²: the reserve that ends a slide
  handbrake_grip = 1.2;
  handbrake_cornering = 4;
  offroad_grip = 4;
  braking_grip = 0.75; // share of the grip left when braking hard
  offroad_drag = 3.5; // m/s² extra off the asphalt
  offroad_top_speed = 22;
  radius = 0.95; // collision circles at the front and back axles
  bounce = 0.25; // fraction of the speed into a wall that comes back
  // Suspension
  suspension_frequency = 1.3; // Hz the body sways at...
  suspension_damping = 0.35; // ...and how fast it settles (1 = no overshoot)
  roll_gain = 0.01; // rad of lean per m/s² sideways
  pitch_gain = 0.0065; // rad of dive/squat per m/s² forward
  jolt = 0.05; // rad/s of sway per m/s lost in a hit
  max_lean = 0.17; // rad, roll and pitch (the bump stops)
  travel = 0.12; // m the body moves up and down

  x = 0;
  z = 0;
  heading = 0;
  forward_speed = 0; // m/s, along the heading
  side_speed = 0; // m/s, to the car's right
  steer = 0; // front wheel angle, radians (positive = left)
  turn_rate = 0; // rad/s the heading is changing at
  on_road = true;
  impact = 0; // speed lost in the last hit (m/s), for effects

  // The ground under the car: height (the wheels' average), and its slope
  // along the car (positive = nose up) and across it (positive = left side up).
  y = 0;
  ground_pitch = 0;
  ground_roll = 0;

  #world;
  #body;
  #wheels; // [{ object, x, z, front }]
  #wheel_y = [0, 0, 0, 0]; // ground height under each wheel
  #spin = 0; // the wheels' turn, radians
  #time = 0;
  // The body: height of its origin, pitch (positive = nose up) and roll
  // (positive = left side up), all in the world, not relative to the ground.
  #heave;
  #pitch;
  #roll;

  // objects: the car's meshes ("body" and the wheels, see tools/build_car.mjs)
  constructor(world, objects) {
    this.#world = world;
    this.#body = objects.find((o) => o.name === "body");
    this.#wheels = WHEELS.map((w) => ({ ...w, object: objects.find((o) => o.name === w.name) }));
    this.#heave = new Spring(this.suspension_frequency, this.suspension_damping);
    this.#pitch = new Spring(this.suspension_frequency, this.suspension_damping);
    this.#roll = new Spring(this.suspension_frequency, this.suspension_damping);
    this.reset();
  }

  // Back to the start, standing still.
  reset() {
    const s = this.#world.spawn;
    this.x = s.x;
    this.z = s.z;
    this.heading = s.heading;
    this.forward_speed = this.side_speed = this.steer = this.turn_rate = 0;
    this.#ground();
    this.#heave.set(this.y);
    this.#pitch.set(this.ground_pitch);
    this.#roll.set(this.ground_roll);
    this.#write();
  }

  get speed() {
    return Math.hypot(this.forward_speed, this.side_speed);
  }
  // On the ground, between the axles.
  get position() {
    return vec3(this.x, this.y, this.z);
  }
  // Unit vector the car points to, seen from above.
  get forward() {
    return vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }
  // The body on its suspension: the height of its underside's middle (the
  // model's origin), and its pitch (positive = nose up) and roll (positive =
  // left side up) in radians.
  get body_y() {
    return this.#heave.value;
  }
  get pitch() {
    return this.#pitch.value;
  }
  get roll() {
    return this.#roll.value;
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
    const before = this.#velocity();

    // Steering: the wheels turn at a limited rate, less at speed.
    const v = this.forward_speed;
    const limit = this.max_steer / (1 + Math.abs(v) / this.steer_falloff);
    const target = steer_input * limit;
    const step = this.steer_speed * dt;
    this.steer += clamp(target - this.steer, -step, step);

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
    a -= G * Math.sin(this.ground_pitch); // the slope

    // Resistance always opposes the motion and never reverses it.
    // Left alone and (nearly) stopped, the car holds itself on a slope.
    const hold = !throttle && !braking && Math.abs(v) < this.hold_speed ? this.hold : 0;
    const resist = this.rolling + this.drag * v * v + (this.on_road ? 0 : this.offroad_drag) + hold;
    const after = v + a * dt;
    const slowed = Math.abs(after) - resist * dt;
    this.forward_speed = slowed > 0 ? Math.sign(after) * slowed : (throttle || braking) && !handbrake ? after : 0;

    // Grip: what the tyres have left to turn the car and hold it sideways.
    const hard_braking = braking && v > 0.5 ? this.braking_grip : 1;
    const cornering = (handbrake ? this.handbrake_cornering : this.on_road ? this.cornering : this.offroad_cornering) * hard_braking;
    const grip = handbrake ? this.handbrake_grip : this.on_road ? this.grip : this.offroad_grip;

    // Turning: where the front wheels point (bicycle model), but no faster
    // than the tyres can bend the car's path at this speed. The handbrake
    // only frees the rear: the car still turns as without it, and slides.
    const turn_limit = (this.on_road ? this.cornering : this.offroad_cornering) / Math.max(Math.abs(this.forward_speed), 1);
    const turn = clamp((this.forward_speed * Math.tan(this.steer)) / this.wheelbase, -turn_limit, turn_limit);
    this.turn_rate += (turn - this.turn_rate) * (1 - Math.exp(-dt / this.turn_lag));
    // The velocity keeps its direction while the car turns under it: that
    // shows up as sideways speed, which the tyres then absorb (or not: a slide).
    let { vx, vz } = this.#velocity();
    this.heading += this.turn_rate * dt;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.#set_velocity(vx, vz);
    const lost = Math.sign(this.side_speed) * Math.min(Math.abs(this.side_speed) * (1 - Math.exp(-grip * dt)), cornering * this.slide * dt);
    this.side_speed -= lost;
    // Some of the absorbed sideways speed carries on forward (arcade momentum).
    this.forward_speed += Math.sign(this.forward_speed) * Math.abs(lost) * 0.3;

    ({ vx, vz } = this.#velocity());
    this.x += vx * dt;
    this.z += vz * dt;

    this.#collide(fx, fz, vx, vz);
    this.#spin += (this.forward_speed / WHEEL_RADIUS) * dt;
    this.#suspension(dt, before);
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

  // Reads the ground under the wheels.
  #ground() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    // The car's left is (fz, 0, -fx).
    const y = this.#wheel_y;
    this.#wheels.forEach((w, i) => {
      y[i] = this.#world.height(this.x + fz * w.x + fx * w.z, this.z - fx * w.x + fz * w.z);
    });
    this.y = (y[0] + y[1] + y[2] + y[3]) / 4;
    this.ground_pitch = Math.atan2((y[0] + y[1] - y[2] - y[3]) / 2, WHEEL_Z * 2);
    this.ground_roll = Math.atan2((y[0] + y[2] - y[1] - y[3]) / 2, WHEEL_X * 2);
  }

  // The body on its springs. `before`: the velocity at the start of the step.
  #suspension(dt, before) {
    const ground = { y: this.y, pitch: this.ground_pitch, roll: this.ground_roll };
    this.#ground();

    // What the step did to the velocity, in the car's frame, is what pushes
    // the body around. Its normal range sets the lean; a hit is a jolt.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const now = this.#velocity();
    const dvx = now.vx - before.vx, dvz = now.vz - before.vz;
    const forward = dvx * fx + dvz * fz, left = dvx * fz - dvz * fx; // m/s gained this step
    const most = 16 * dt;
    const a_forward = clamp(forward, -most, most) / dt, a_left = clamp(left, -most, most) / dt;
    this.#pitch.speed += (forward - a_forward * dt) * this.jolt;
    this.#roll.speed += (left - a_left * dt) * this.jolt;

    // Accelerating lifts the nose, braking drops it; turning left (pushed to
    // the left) leans the body to the right, its left side up. The ground's
    // own movement carries the body with it, late: bumps and crests.
    this.#pitch.step(dt, this.ground_pitch + a_forward * this.pitch_gain, (this.ground_pitch - ground.pitch) / dt);
    this.#roll.step(dt, this.ground_roll + a_left * this.roll_gain, (this.ground_roll - ground.roll) / dt);
    this.#heave.step(dt, this.y, (this.y - ground.y) / dt);
    this.#pitch.limit(this.ground_pitch, this.max_lean, (this.ground_pitch - ground.pitch) / dt);
    this.#roll.limit(this.ground_roll, this.max_lean, (this.ground_roll - ground.roll) / dt);
    this.#heave.limit(this.y, this.travel, (this.y - ground.y) / dt);
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
    // In the model +x is the car's left and +z its front: nose up is a
    // negative turn around x, left side up a positive turn around z.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.#body.position = vec3(this.x, this.#heave.value, this.z);
    this.#body.rotation = euler(mul(rot_y(this.heading), mul(rot_x(-this.#pitch.value), rot_z(this.#roll.value))));
    // The wheels stay on the ground, each on its own patch.
    const lean = rot_z(this.ground_roll), spin = rot_x(this.#spin);
    this.#wheels.forEach((w, i) => {
      w.object.position = vec3(this.x + fz * w.x + fx * w.z, this.#wheel_y[i] + WHEEL_RADIUS, this.z - fx * w.x + fz * w.z);
      w.object.rotation = euler(mul(rot_y(this.heading + (w.front ? this.steer : 0)), mul(lean, spin)));
    });
  }
}
