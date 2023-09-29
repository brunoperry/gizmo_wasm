import Display from "./Display.js";
import WASM from "./WASM.js";
import { mat4_from_rotation, vec3, vec3_cross, vec3_scale_and_add, vec3_transform_mat4} from "./math.js";
import InputController from "./InputController.js";
export default class Camera3D {
  #MOVEMENT_SPEED = 0.1;
  #ROTATE_SPEED = 0.002;
  #UP = vec3(0, 1, 0);
  #cam_buffer;

  #pos;
  #dir;
  #up;

  constructor(pos = vec3(0, 0, 0), dir = vec3(0, 0, 1.0), up = vec3(0, 1, 0)) {
    this.#pos = pos;
    this.#dir = dir;
    this.#up = up;
  }

  initialize(buffers) {
    this.#cam_buffer = [...buffers];

    this.aspect_x = Display.width / Display.height;
    this.aspect_y = Display.height / Display.width;

    this.fov_x = 60;
    this.fov_y = 60;

    this.z_near = 0.01;
    this.z_far = 100;

    this.#pos = vec3(3.193973742110784, 4.434063983181778, -22.34138778876013 );

    this.position = this.#pos;
    this.direction = this.#dir;

    this.up = this.#up;
  }

  update(delta) {
    this.#mouseUpdate();
    this.#checkInputs();

  }
  #mouseUpdate() {
    const rotateY = mat4_from_rotation(-InputController.MouseDX * this.#ROTATE_SPEED, this.#UP);

    const toRotateAround = vec3_cross(this.#dir, this.#UP);
    const rotateX = mat4_from_rotation(InputController.MouseDY * this.#ROTATE_SPEED, toRotateAround);
    

    this.#dir = vec3_transform_mat4(this.#dir, rotateX);
    this.#dir = vec3_transform_mat4(this.#dir, rotateY);
    
    this.direction = vec3(this.#dir.x, this.#dir.y, this.#dir.z);
  }
  #checkInputs() {
    
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
  }

  #move_forward() {

    this.position = vec3_scale_and_add(this.#pos, this.#dir, this.#MOVEMENT_SPEED);
  }
  #move_backward() {
    this.position = vec3_scale_and_add(this.#pos, this.#dir, -this.#MOVEMENT_SPEED);
  }
  #strafe_left() {
    const strafeDirection = vec3_cross(this.#dir, this.#UP);
    this.position = vec3_scale_and_add(this.#pos, strafeDirection, -this.#MOVEMENT_SPEED);
  }
  #strafe_right() {
    const strafeDirection = vec3_cross(this.#dir, this.#UP);
    this.position = vec3_scale_and_add(this.#pos, strafeDirection, this.#MOVEMENT_SPEED);
  }

  get position() {
    return this.#pos;
  }
  set position(val) {
    this.#pos = val;
    new Float32Array(WASM.mem, this.#cam_buffer[6], 3).set([val.x, val.y, val.z]);
  }
  get direction() {
    return this.#dir;
  }
  set direction(val) {
    this.#dir = val;
    new Float32Array(WASM.mem, this.#cam_buffer[7], 3).set([val.x, val.y, val.z]);
  }

  get aspect_x() {
    return new Float32Array(WASM.mem, this.#cam_buffer[0], 1)[0];
  }
  set aspect_x(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[0], 1).set([val]);
  }
  get aspect_y() {
    return new Float32Array(WASM.mem, this.#cam_buffer[1], 1)[0];
  }
  set aspect_y(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[1], 1).set([val]);
  }
  set fov(val) {
    this.fov_x = val;
    this.fov_y = val;
  }
  get fov() {
    return this.fov_x;
  }
  get fov_x() {
    return new Uint32Array(WASM.mem, this.#cam_buffer[2], 1)[0];
  }
  set fov_x(val) {
    const fov_y = val * (Math.PI / 180);
    const fov_x = Math.atan(Math.tan(fov_y / 2) * this.aspect_x) * 2;
    new Float32Array(WASM.mem, this.#cam_buffer[2], 1).set([fov_x]);
  }
  get fov_y() {
    return new Uint32Array(WASM.mem, this.#cam_buffer[3], 1)[0];
  }
  set fov_y(val) {
    const fov_y = val * (Math.PI / 180);
    new Float32Array(WASM.mem, this.#cam_buffer[3], 1).set([fov_y]);
  }
  get z_near() {
    return new Float32Array(WASM.mem, this.#cam_buffer[4], 1)[0];
  }
  set z_near(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[4], 1).set([val]);
  }
  get z_far() {
    return new Float32Array(WASM.mem, this.#cam_buffer[5], 1)[0];
  }
  set z_far(val) {
    new Float32Array(WASM.mem, this.#cam_buffer[5], 1).set([val]);
  }
  get up() {
    return this.#up;
  }
  set up(val) {
    this.#up = val;
    new Float32Array(WASM.mem, this.#cam_buffer[8], 3).set([val.x, val.y, val.z]);
  }
}
