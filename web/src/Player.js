import Camera3D from "./Camera3D.js";
import InputController from "./InputController.js";
import Shotgun from "./Shotgun.js";
import { vec3, vec3_from_buffer } from "./math.js";

export default class Player {
  #pos_b;
  #dir_b;

  #MOVEMENT_SPEED = 0.12;
  #ROTATE_SPEED = 0.002;
  #UP = glMatrix.vec3.fromValues(0, 1, 0);
  #camera;

  #shotgun;

  velocity = vec3();
  acceleration = vec3(0, 4.8, 0);
  height = 2;
  #jump_speed = -1.0;
  #is_jumping = false;

  constructor() {
    this.#camera = new Camera3D();
    this.#shotgun = new Shotgun();
  }

  initialize(buffers) {
    this.#camera.initialize(buffers);
    this.position = vec3(-6.1571736335754395, -6.397594928741455, 10.573966026306152);
    this.direction = vec3(0.549171507358551, 0.5923717617988586, -0.589495062828064);
  }

  update() {
    this.#mouseUpdate();
    this.#checkInputs();

    // this.#shotgun.update(this.position);
  }
  #mouseUpdate() {
    const rotateY = glMatrix.mat4.create();
    glMatrix.mat4.fromRotation(
      rotateY,
      -InputController.MouseDX * this.#ROTATE_SPEED,
      this.#UP
    );
    const toRotateAround = glMatrix.vec3.create();
    glMatrix.vec3.cross(toRotateAround, this.#dir_b, this.#UP);
    const rotateX = glMatrix.mat4.create();
    glMatrix.mat4.fromRotation(
      rotateX,
      InputController.MouseDY * this.#ROTATE_SPEED,
      toRotateAround
    );
    glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateX);
    glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateY);
    this.direction = vec3(this.#dir_b[0], this.#dir_b[1], this.#dir_b[2]);
  }
  #checkInputs() {
    if (InputController.getKey(InputController.Key.SPACE)) {
      if (this.#is_jumping) return;
      this.velocity.y = this.#jump_speed;
      this.#is_jumping = true;
    }
    if (InputController.getKey(InputController.Key.W)) {
      this.#move_forward();
    } else if (InputController.getKey(InputController.Key.S)) {
      this.#move_backward();
    }

    if (InputController.getKey(InputController.Key.A)) {
      this.#strafe_left();
    } else if (InputController.getKey(InputController.Key.D)) {
      this.#strafe_right();
    }

    if (InputController.getKey(InputController.Key.UP)) {
      this.#move_up();
    } else if (InputController.getKey(InputController.Key.DOWN)) {
      this.#move_down();
    }
    this.position = vec3_from_buffer(this.#pos_b);
  }

  #move_forward() {
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      this.#dir_b,
      this.#MOVEMENT_SPEED
    );
  }
  #move_backward() {
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      this.#dir_b,
      -this.#MOVEMENT_SPEED
    );
  }

  #strafe_left() {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.#UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      -this.#MOVEMENT_SPEED
    );
  }
  #strafe_right() {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.#UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      this.#MOVEMENT_SPEED
    );
  }

  #move_up() {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.#UP, this.#MOVEMENT_SPEED);
  }
  #move_down() {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.#UP, -this.#MOVEMENT_SPEED);
  }

  get position() {
    return this.#camera.position;
  }
  set position(pos) {
    this.#pos_b = glMatrix.vec3.fromValues(pos.x, pos.y, pos.z);
    this.#camera.position = pos;

    this.#shotgun.position = pos;
  }

  get direction() {
    return this.#camera.direction;
  }
  set direction(dir) {
    this.#dir_b = glMatrix.vec3.fromValues(dir.x, dir.y, dir.z);
    this.#camera.direction = dir;
  }
}
