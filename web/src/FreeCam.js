import Camera3D from "./Camera3D.js";
import InputController from "./InputController.js";
import { vec3, vec3_from_buffer, vec3_lerp } from "./math.js";

class FreeCamera extends Camera3D {
  #pos_b;
  #dir_b;
  constructor(pos = vec3(0, 0, 8)) {
    super();

    this.MOVEMENT_SPEED = 0.1;
    this.ROTATE_SPEED = 0.002;

    this.#dir_b = glMatrix.vec3.fromValues(0, 0, -1);
    this.#pos_b = glMatrix.vec3.fromValues(pos.x, pos.y, pos.z);
    this.UP = glMatrix.vec3.fromValues(0, 1, 0);
  }

  update(delta) {
    this.mouseUpdate(delta);
    this.checkInputs(delta);
  }

  /**
   * @param {vec2} newMousePosition
   */
  mouseUpdate(delta) {
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
    glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateX);
    glMatrix.vec3.transformMat4(this.#dir_b, this.#dir_b, rotateY);

    // this.direction = vec3(this.#dir_b[0], this.#dir_b[1], this.#dir_b[2]);
    this.direction = vec3_from_buffer(this.#dir_b);
  }

  move_forward(delta) {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.#dir_b, this.MOVEMENT_SPEED);
    this.position = vec3_from_buffer(this.#pos_b);
    // this.#set_pos(delta);
  }

  move_backward(delta) {
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      this.#dir_b,
      -this.MOVEMENT_SPEED
    );
    this.position = vec3_from_buffer(this.#pos_b);
    // this.#set_pos(delta);
  }

  strafe_left(delta) {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      -this.MOVEMENT_SPEED
    );
    this.position = vec3_from_buffer(this.#pos_b);
    // this.#set_pos(delta);
  }

  strafe_right(delta) {
    const strafeDirection = glMatrix.vec3.create();
    glMatrix.vec3.cross(strafeDirection, this.#dir_b, this.UP);
    glMatrix.vec3.scaleAndAdd(
      this.#pos_b,
      this.#pos_b,
      strafeDirection,
      this.MOVEMENT_SPEED
    );
    this.position = vec3_from_buffer(this.#pos_b);
    // this.#set_pos(delta);
  }

  move_up(delta) {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.UP, this.MOVEMENT_SPEED);
    this.position = vec3_from_buffer(this.#pos_b);
    // this.#set_pos(delta);
  }

  move_down(delta) {
    glMatrix.vec3.scaleAndAdd(this.#pos_b, this.#pos_b, this.UP, -this.MOVEMENT_SPEED);
    this.position = vec3_from_buffer(this.#pos_b);
    // this.#set_pos(delta);
  }
  checkInputs(delta) {
    if (InputController.getKey(InputController.Key.W)) {
      this.move_forward(delta);
    } else if (InputController.getKey(InputController.Key.S)) {
      this.move_backward(delta);
    }

    if (InputController.getKey(InputController.Key.A)) {
      this.strafe_left(delta);
    } else if (InputController.getKey(InputController.Key.D)) {
      this.strafe_right(delta);
    }

    if (InputController.getKey(InputController.Key.UP)) {
      this.move_up(delta);
    } else if (InputController.getKey(InputController.Key.DOWN)) {
      this.move_down(delta);
    }
  }

  createViewMatrix() {
    const center = glMatrix.vec3.create();
    glMatrix.vec3.add(center, this.#pos_b, this.#dir_b);

    const viewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(viewMatrix, this.#pos_b, center, this.UP);

    return viewMatrix;
  }

  #set_pos(delta) {
    const vd = vec3_from_buffer(this.#pos_b);
    this.position = vec3_lerp(this.position, vd, this.MOVEMENT_SPEED * delta);
  }
}

export default FreeCamera;
