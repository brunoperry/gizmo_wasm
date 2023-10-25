import Resources from "./Resources.js";
import WASM from "./WASM.js";

export default class Texture {
  name = null;
  id = -1;
  #image_data = null;
  width;
  height;
  constructor(image_data, buffer, id) {
    this.name = image_data.name;
    this.id = id;
    // const image = Resources.get_image(texture_name);
    this.width = image_data.width;
    this.height = image_data.height;
    this.#image_data = image_data;

    new Uint8ClampedArray(WASM.mem, buffer, this.length).set(this.data);
  }

  get length() {
    return this.#image_data.data.data.length;
  }

  get data() {
    return this.#image_data.data.data;
  }

  set data(image_data) {
    this.#image_data = image_data.data.data;
  }
}
