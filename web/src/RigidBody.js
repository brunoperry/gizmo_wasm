import {
  mat3_identity,
  mat3_inverse,
  mat3_mul_mat3,
  mat3_mul_vec3,
  mat4_identity,
  mat4_make_translation,
  quat,
  quat_from_vec,
  quat_multiply,
  quat_normalize,
  quat_to_matrix,
  vec3,
  vec3_add,
  vec3_scale,
} from "./math.js";

export default class RigidBody {
  constructor({
    position = vec3(),
    rotation = quat(),
    mass = 1,
    inertia = mat3_identity(),
    friction = 0.5,
    restitution = 0.2,
    linearDamping = 0.1,
    angularDamping = 0.1,
  }) {
    this.position = position;
    this.rotation = rotation;
    this.mass = mass;
    this.velocity = vec3();
    this.acceleration = vec3();
    this.forceAccum = vec3();
    this.torqueAccum = vec3();
    this.inverseMass = 1 / mass;
    this.inverseInertiaTensor = mat3_inverse(inertia);
    this.angularVelocity = vec3();
    this.angularAcceleration = vec3();
    this.transformMatrix = mat4_identity();
    this.friction = friction;
    this.restitution = restitution;
    this.linearDamping = linearDamping;
    this.angularDamping = angularDamping;
  }

  integrate(dt) {
    // Integrate linear motion
    const linearAcceleration = vec3_add(
      this.acceleration,
      vec3_scale(this.forceAccum, this.inverseMass)
    );

    this.velocity = vec3_add(this.velocity, vec3_scale(linearAcceleration, dt));
    this.position = vec3_add(this.position, vec3_scale(this.velocity, dt));

    // Integrate angular motion
    const acceleration = vec3_add(
      this.angularAcceleration,
      mat3_mul_vec3(this.inverseInertiaTensor, this.torqueAccum)
    );

    this.angularVelocity = vec3_add(this.angularVelocity, vec3_scale(acceleration, dt));
    const angularDisplacement = quat_from_vec(vec3_scale(this.angularVelocity, dt));

    this.rotation = quat_normalize(quat_multiply(this.rotation, angularDisplacement));

    // Reset accumulated forces and torques
    this.forceAccum = vec3();
    this.torqueAccum = vec3();

    // Update transformation matrix
    this.transformMatrix = mat3_mul_mat3(
      quat_to_matrix(this.rotation),
      mat4_make_translation(this.position)
    );
  }

  addForce(force) {
    this.forceAccum = vec3_add(this.forceAccum, force);
  }

  addTorque(torque) {
    this.torqueAccum = vec3_add(this.forceAccum, torque);
  }

  clearForces() {
    this.forceAccum = vec3();
    this.torqueAccum = vec3();
  }
}
