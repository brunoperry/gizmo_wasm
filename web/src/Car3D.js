import Object3D from "./Object3D.js";
import RigidBody from "./RigidBody.js";
import { mat3_inertia, quat_euler } from "./math.js";

export default class Car3D extends Object3D {
  //   #obj;
  constructor() {
    super("cube");
    // this.#obj = Resources.get_object("cube");

    this.rigidBody = new RigidBody({
      position: this.transform.position,
      orientation: quat_euler(0, 0, 0),
      mass: 1000,
      inertia: mat3_inertia(100, 100, 100),
      friction: 0.5,
      restitution: 0.2,
      linearDamping: 0.1,
      angularDamping: 0.1,
    });
    this.isDynamic = true;
  }

  //   get obj() {
  //     return this.#obj;
  //   }

  //
}
