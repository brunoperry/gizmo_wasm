import { vec3, vec3_to_buffer } from "./math.js";
import WASM from "./WASM.js";

export default class Cam3D {
  #cam_buffer;

  #pos;
  #frt;
  #rgt;
  #up;

  #y = 0;
  #p = 0;
  #r = 0;

  constructor(
    pos = vec3(),
    front = vec3(0, 0, 1),
    right = vec3(1, 0, 0),
    up = vec3(0, 1, 0)
  ) {
    this.#pos = pos;
    this.#frt = front;
    this.#rgt = right;
    this.#up = up;
  }

  update() {
    // Calculate the front vector
    this.front.x = Math.cos(this.yaw) * Math.cos(this.pitch);
    this.front.y = Math.sin(this.pitch);
    this.front.z = Math.sin(this.yaw) * Math.cos(this.pitch);

    // Normalize the front vector
    const frontLength = Math.sqrt(
      this.front.x * this.front.x +
        this.front.y * this.front.y +
        this.front.z * this.front.z
    );
    this.front.x /= frontLength;
    this.front.y /= frontLength;
    this.front.z /= frontLength;

    // Calculate the right and up vectors
    this.right.x = -Math.sin(this.yaw);
    this.right.y = 0;
    this.right.z = Math.cos(this.yaw);

    this.up.x = -Math.cos(this.yaw) * Math.sin(this.pitch);
    this.up.y = Math.cos(this.pitch);
    this.up.z = -Math.sin(this.yaw) * Math.sin(this.pitch);

    //  // Calculate the new camera position
    // camera->position.x += distance * camera->front.x;
    // camera->position.y += distance * camera->front.y;
    // camera->position.z += distance * camera->front.z;
  }

  initialize(buffer) {
    this.#cam_buffer = buffer;

    this.position = this.#pos;
    this.front = this.#frt;
    this.right = this.#rgt;
    this.up = this.#up;

    this.pitch = this.#p;
    this.yaw = this.#y;
    this.roll = this.#r;
  }

  get position() {
    return this.#pos;
  }
  set position(val) {
    this.#pos = val;

    console.log(this.#pos);
    new Float32Array(WASM.mem, this.#cam_buffer[0], 3).set(vec3_to_buffer(this.#pos));
  }

  get front() {
    return this.#frt;
  }
  set front(val) {
    this.#frt = val;
    new Float32Array(WASM.mem, this.#cam_buffer[1], 3).set(vec3_to_buffer(this.#frt));
  }

  get right() {
    return this.#rgt;
  }
  set right(val) {
    this.#rgt = val;
    new Float32Array(WASM.mem, this.#cam_buffer[2], 3).set(vec3_to_buffer(this.#rgt));
  }

  get up() {
    return this.#up;
  }
  set up(val) {
    this.#up = val;
    new Float32Array(WASM.mem, this.#cam_buffer[3], 3).set(vec3_to_buffer(this.#up));
  }

  get pitch() {
    return this.#p;
  }
  set pitch(val) {
    this.#p = val;
    new Float32Array(WASM.mem, this.#cam_buffer[4], 1).set([this.#p]);
  }

  get yaw() {
    return this.#y;
  }
  set yaw(val) {
    this.#y = val;
    new Float32Array(WASM.mem, this.#cam_buffer[5], 1).set([this.#y]);
  }

  get roll() {
    return this.#r;
  }
  set roll(val) {
    this.#r = val;
    new Float32Array(WASM.mem, this.#cam_buffer[6], 1).set([this.#r]);
  }
}
