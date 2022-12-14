import Camera3D from "./Camera3D.js";
import InputController from "./InputController.js";
import { vec3, vec3_from_buffer, vec3_negate } from "./math.js";
import Resources from "./Resources.js";
import Shotgun from "./Shotgun.js";

export default class Player extends Camera3D {
  #pos_b;
  #dir_b;

  velocity = vec3();
  acceleration = vec3(0, 4.8, 0);

  height = 2;
  #colliders = [];

  #jump_speed = -1.0;
  #is_jumping = false;

  weapon;

  constructor(pos = vec3(0, -15, 8)) {
    super();

    this.weapon = new Shotgun();

    this.MOVEMENT_SPEED = 0.12;
    this.ROTATE_SPEED = 0.002;

    this.#dir_b = glMatrix.vec3.fromValues(0, 0, -1);
    this.#pos_b = glMatrix.vec3.fromValues(pos.x, pos.y, pos.z);
    this.UP = glMatrix.vec3.fromValues(0, 1, 0);
  }

  update() {
    this.mouseUpdate();
    this.checkInputs();
    this.apply_physics();

    this.weapon.update(vec3_negate(this.position));

    console.log(this.direction.z);
  }

  apply_physics() {
    this.velocity.y += this.acceleration.y * 0.1;
    this.#pos_b[1] += this.velocity.y * 0.1;

    if (this.#is_jumping) {
      this.#pos_b[1] += this.velocity.y;
      this.velocity.y -= 0.44;
    }
    const y = this.#pos_b[1];
    this.#colliders.forEach((col) => {
      if (y > col.position.y - this.height) {
        this.#is_jumping = false;
        this.#pos_b[1] = col.position.y - this.height;
        this.velocity.y = 0;
        return;
      }
    });

    this.position = vec3_from_buffer(this.#pos_b);
  }

  mouseUpdate() {
    const rotateY = glMatrix.mat4.create();
    glMatrix.mat4.fromRotation(
      rotateY,
      -InputController.MouseDX * this.ROTATE_SPEED,
      this.UP
    );

    const toRotateAround = glMatrix.vec3.create();
    glMatrix.vec3.cross(toRotateAround, this.#dir_b, this.UP);
    const rotateX = glMatrix.mat4.create();
    glMatrix.mat4.fromRotation(
      rotateX,
      InputController.MouseDY * this.ROTATE_SPEED,
      toRotateAround
    );
    console.log(rotateY);
    glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateX);
    glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateY);

    // this.direction = vec3(this.#dir_b[0], this.#dir_b[1], this.#dir_b[2]);
    this.direction = vec3_from_buffer(this.#dir_b);
  }

  checkInputs() {
    if (InputController.getKey(InputController.Key.SPACE)) {
      if (this.#is_jumping) return;
      this.velocity.y = this.#jump_speed;
      this.#is_jumping = true;
    }
    if (InputController.getKey(InputController.Key.W)) {
      this.move_forward();
    } else if (InputController.getKey(InputController.Key.S)) {
      this.move_backward();
    }

    if (InputController.getKey(InputController.Key.A)) {
      this.strafe_left();
    } else if (InputController.getKey(InputController.Key.D)) {
      this.strafe_right();
    }

    if (InputController.getKey(InputController.Key.UP)) {
      this.move_up();
    } else if (InputController.getKey(InputController.Key.DOWN)) {
      this.move_down();
    }
    this.position = vec3_from_buffer(this.#pos_b);
  }

  move_forward() {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.#dir_b, this.MOVEMENT_SPEED);
  }
  move_backward() {
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      this.#dir_b,
      -(this.MOVEMENT_SPEED * 0.3)
    );
  }

  strafe_left() {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      -(this.MOVEMENT_SPEED * 0.3)
    );
  }
  strafe_right() {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      this.MOVEMENT_SPEED * 0.3
    );
  }

  move_up() {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.UP, this.MOVEMENT_SPEED);
  }
  move_down() {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.UP, -this.MOVEMENT_SPEED);
  }
  add_collider(mesh) {
    this.#colliders.push(mesh);
  }

  add_weapon(weapon) {}
}
