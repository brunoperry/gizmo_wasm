import Cam3D from "./Cam3D.js";
import Camera3D from "./Camera3D.js";
import InputController from "./InputController.js";
import { mat4_identity, mat4_make_scale, vec3, vec3_from_buffer } from "./math.js";
import Shotgun from "./Shotgun.js";

export default class Player {
  #pos_b;
  #dir_b;

  #MOVEMENT_SPEED = 0.12;
  #ROTATE_SPEED = 0.002;
  #UP = glMatrix.vec3.fromValues(0, 1, 0);
  #camera;

  #cam;

  velocity = vec3();
  acceleration = vec3(0, 4.8, 0);
  height = 2;
  #jump_speed = -1.0;
  #is_jumping = false;

  #weapon;

  constructor() {
    this.#dir_b = glMatrix.vec3.fromValues(0, 0, -1);
    this.#pos_b = glMatrix.vec3.fromValues(0, 0, 0);

    this.#camera = new Camera3D();
    this.#weapon = new Shotgun();

    const m = mat4_make_scale(2, 3, 4);

    this.#cam = new Cam3D();
  }

  initialize(buffers) {
    this.#camera.initialize(buffers);
    this.position = vec3(0, -2, 0);
  }

  update() {
    this.#mouseUpdate();
    this.#checkInputs();

    // const r = vec3_dir_to_rot(vec3_negate(this.direction));
    // this.#weapon.update(vec3_negate(this.position), r);
  }
  #mouseUpdate() {
    // const rotateY = glMatrix.mat4.create();
    // glMatrix.mat4.fromRotation(
    //   rotateY,
    //   -InputController.MouseDX * this.#ROTATE_SPEED,
    //   this.#UP
    // );
    // const toRotateAround = glMatrix.vec3.create();
    // glMatrix.vec3.cross(toRotateAround, this.#dir_b, this.#UP);
    // const rotateX = glMatrix.mat4.create();
    // glMatrix.mat4.fromRotation(
    //   rotateX,
    //   InputController.MouseDY * this.#ROTATE_SPEED,
    //   toRotateAround
    // );
    // glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateX);
    // glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateY);
    // this.direction = vec3(this.#dir_b[0], this.#dir_b[1], this.#dir_b[2]);
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

    this.#cam.update(this.#pos_b);
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
      -(this.#MOVEMENT_SPEED * 0.3)
    );
  }

  #strafe_left() {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.#UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      -(this.#MOVEMENT_SPEED * 0.3)
    );
  }
  #strafe_right() {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.#UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      this.#MOVEMENT_SPEED * 0.3
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
    this.#camera.position = pos;
  }

  get direction() {
    return this.#camera.direction;
  }
  set direction(dir) {
    this.#camera.direction = dir;
  }
}
