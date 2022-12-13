import Resources from "./Resources.js";

export default class Texture {
  name = null;
  #image_data = null;
  width;
  height;
  constructor(texture_name) {
    this.name = texture_name;
    const image = Resources.get_image(texture_name);
    this.width = image.width;
    this.height = image.height;
    this.#image_data = image;
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
