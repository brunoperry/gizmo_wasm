import AudioTrack from "./AudioTrack.js";
import Object3D from "./Object3D.js";
import Texture from "./Texture.js";
import WASM from "./WASM.js";
import USDA from "./USDA.js";
import Animator from "./Animator.js";

export default class Resources {
  static objects = [];
  static textures = [];
  static audios = [];
  static splash = null;
  static main_audio = null;
  static #textures_by_url = new Map();
  static #clips = new Map(); // data.json entry name -> { clip: [start, end] }

  static async initialize(listener, state) {
    if (listener) listener(state, "loading data.json");
    const raw_data = await Resources.#load_json_data("resources/data.json");

    for (let i = 0; i < raw_data.images.length; i++) {
      if (listener) listener(state, `loading image: ${raw_data.images[i].name}`);
      const image_data = await Resources.#load_image_file(raw_data.images[i]);
      Resources.#add_texture(
        image_data,
        new URL(raw_data.images[i].url, document.baseURI).href,
      );
    }

    for (const entry of raw_data.meshes) {
      if (listener) listener(state, `loading object: ${entry.name}`);

      const obj_type = entry.url.split(".").pop().toLowerCase();
      let loaded;
      switch (obj_type) {
        case "obj":
          loaded = await Resources.#load_obj_file(entry.url, entry.crease_angle);
          break;
        case "fbx":
          loaded = await Resources.#load_fbx_file(entry.url, entry.crease_angle);
          break;
        case "usda":
        case "usd":
          loaded = await Resources.#load_usd_file(entry.url, entry.crease_angle);
          break;
        default:
          throw new Error(`Unsupported mesh format: ${entry.url}`);
      }
      if (entry.clips) Resources.#clips.set(entry.name, entry.clips);
      // A USD file can hold several meshes; get_objects(entry.name) returns them all.
      for (const obj of [].concat(loaded)) {
        if (entry.texture) obj.texture = Resources.get_image(entry.texture);
        obj.group = entry.name;
        Resources.objects.push(obj);
      }
    }

    for (let i = 0; i < raw_data.audios.length; i++) {
      if (listener) listener(state, `loading audio: ${raw_data.audios[i].name}`);
      const audio_data = await Resources.#load_audio_file(raw_data.audios[i].url);

      const audio = new AudioTrack(audio_data, raw_data.audios[i].name);
      if (audio.name === "main") {
        Resources.main_audio = audio;
        continue;
      }
      Resources.audios.push(audio);
    }

    Resources.DATA = raw_data;
  }

  static get_object(obj_name) {
    const obj = Resources.objects.find((obj) => obj.name === obj_name);
    if (!obj) {
      // Common mix-up: a data.json entry name that holds several meshes (USD).
      const group = Resources.objects.filter((o) => o.group === obj_name).map((o) => o.name);
      throw new Error(
        group.length
          ? `"${obj_name}" is a file with ${group.length} meshes (${group.join(", ")}): ` +
              `use Resources.get_objects("${obj_name}") or get_object("<mesh name>")`
          : `No object named "${obj_name}"`
      );
    }
    return Resources.#animate([obj], [obj.clone()])[0];
  }
  // Every object loaded from one data.json mesh entry (e.g. all meshes of a USD file).
  // Skinned meshes of the same skeleton share one Animator: `objects[0].animation`.
  static get_objects(entry_name) {
    const sources = Resources.objects.filter((obj) => obj.group === entry_name);
    return Resources.#animate(sources, sources.map((obj) => obj.clone()));
  }
  // Gives each new instance's skinned objects an Animator, one per skeleton.
  static #animate(sources, copies) {
    const animators = new Map();
    copies.forEach((copy, i) => {
      const skeleton = sources[i].skin?.skeleton;
      if (!skeleton) return;
      if (!animators.has(skeleton)) {
        animators.set(skeleton, new Animator(skeleton, Resources.#clips.get(sources[i].group)));
      }
      copy.animation = animators.get(skeleton);
    });
    return copies;
  }
  static get_image(image_name) {
    return Resources.textures.find((image) => image.name === image_name);
  }
  static async #load_json_data(data_path) {
    const req = await fetch(data_path);
    const res = await req.json();
    return res;
  }
  static async #load_text_data(data_path) {
    const req = await fetch(data_path);
    const res = await req.text();
    return res;
  }

  static async #load_fbx_file(data_path, crease_angle) {
    const parse_block = (from, data) => {
      let data_block = "";
      let start_parse = false;
      let num_brackets = 0;
      for (let i = from; i < data.length; i++) {
        if (start_parse && num_brackets === 0) break;
        const char = data[i];
        data_block += char;
        if (char === "{") {
          if (!start_parse) start_parse = true;
          num_brackets++;
        }
        if (char === "}") {
          num_brackets--;
        }
      }
      const tokens = data_block.split("\n");
      const pop = tokens[0].split(" ");
      tokens[0] = `${pop[0]} ${pop[pop.length - 1]}`;
      let out_data;
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.includes("a:")) {
          out_data = tok.split(" ")[1].split(",");
          break;
        }
      }
      for (let i = 0; i < out_data.length; i++) {
        out_data[i] = parseFloat(out_data[i]);
      }

      return out_data;
    };
    const data = await Resources.#load_text_data(data_path);
    const clean_data = Resources.#cleanString(data);

    let faces = [];
    const vertices = parse_block(clean_data.search("Vertices:"), clean_data);
    const vertices_index = parse_block(
      clean_data.search("PolygonVertexIndex:"),
      clean_data,
    );

    const uvs_index = parse_block(clean_data.search("UVIndex:"), clean_data);
    const uvs = parse_block(clean_data.search("UV:"), clean_data);

    const normals = []; // not read: computed by Object3D.from_faces
    for (let i = 0; i < vertices_index.length; i++) {
      const val = vertices_index[i];
      if (val < 0) {
        vertices_index[i] = Math.abs(parseInt(vertices_index[i] + 1));
      }

      faces.push(vertices_index[i]);
      faces.push(uvs_index[i]);
      faces.push(-1);
    }

    const name_index = clean_data.search("Model: ");
    let name_data = "";
    for (let i = name_index; i < clean_data.length; i++) {
      const char = clean_data[i];
      if (char === "\n") break;
      name_data += char;
    }
    const name = name_data.split(", ")[1].replace(/['"]/g, "").replace("Model::", "");

    const object3d = Object3D.from_faces({
      vertices: vertices,
      uvs: uvs,
      normals: normals,
      faces: faces,
      name: name,
      crease_angle,
    });

    return object3d;
  }
  // .usda (USD ASCII). Each Mesh prim becomes an Object3D named after the
  // prim, with its transform hierarchy baked in. Its texture comes from the
  // bound UsdPreviewSurface: the diffuse texture file, or a 1x1 texture of
  // the diffuse color. A "texture" in data.json overrides it.
  static async #load_usd_file(data_path, crease_angle) {
    const url = new URL(data_path, document.baseURI);
    const warn = (message) => console.warn(`${data_path}: ${message}`);
    const meshes = USDA.load(await Resources.#load_text_data(url), warn);
    if (!meshes.length) warn("no meshes found");

    const objects = [];
    for (const mesh of meshes) {
      const obj = Object3D.from_faces({ ...mesh, crease_angle });
      obj.texture = await Resources.#usd_texture(mesh.material, url, warn);
      objects.push(obj);
    }
    return objects;
  }
  static async #usd_texture(material, base_url, warn) {
    if (!material) return undefined;
    if (material.texture) {
      if (material.texture.includes("<UDIM>")) {
        warn(`UDIM textures are not supported: ${material.texture}`);
      } else {
        const url = new URL(material.texture, base_url).href;
        try {
          return (
            Resources.#textures_by_url.get(url) ??
            Resources.#add_texture(
              await Resources.#load_image_file({ name: url, url }),
              url,
            )
          );
        } catch (error) {
          warn(`could not load texture ${material.texture}`);
        }
      }
    }
    if (!material.color) return undefined;
    // USD colors are linear; textures are sRGB.
    const srgb = (c) => {
      c = Math.min(1, Math.max(0, c || 0));
      return Math.round(
        255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055),
      );
    };
    const rgb = material.color.map(srgb);
    const name = `usd-color:${rgb.join(",")}`;
    return (
      Resources.get_image(name) ??
      Resources.#add_texture({
        name,
        width: 1,
        height: 1,
        data: new ImageData(new Uint8ClampedArray([...rgb, 255]), 1, 1),
      })
    );
  }
  // Texture ids follow creation order, as on the C side.
  static #add_texture(image_data, url = null) {
    const id = Resources.textures.length;
    const buffer = WASM.set_texture_buffer(image_data.width, image_data.height, id);
    const texture = new Texture(image_data, buffer, id);
    Resources.textures.push(texture);
    if (url) Resources.#textures_by_url.set(url, texture);
    return texture;
  }

  static async #load_obj_file(data_path, crease_angle) {
    const data = await Resources.#load_text_data(data_path);
    const lines = data.split("\n");
    let tokens;

    let vertices = [];
    let uvs = [];
    let normals = [];
    let faces = [];
    let name = "no_name";
    for (let i = 0; i < lines.length; i++) {
      tokens = lines[i].split(" ");
      tokens = Resources.#removeEmptyStrings(tokens);

      switch (tokens[0]) {
        case "v":
          vertices.push(parseFloat(tokens[1]));
          vertices.push(parseFloat(tokens[2]));
          vertices.push(parseFloat(tokens[3]));
          break;
        case "vt":
          uvs.push(parseFloat(tokens[1]));
          uvs.push(parseFloat(tokens[2]));
          break;
        case "vn":
          normals.push(parseFloat(tokens[1]));
          normals.push(parseFloat(tokens[2]));
          normals.push(parseFloat(tokens[3]));
          break;
        case "f": {
          // Accepts v, v/vt, v//vn and v/vt/vn, negative (relative) indices,
          // and any convex polygon (split into a triangle fan).
          const counts = [vertices.length / 3, uvs.length / 2, normals.length / 3];
          const corner = (token) =>
            [0, 1, 2].map((k) => {
              const index = parseInt(token.split("/")[k]);
              if (Number.isNaN(index)) return -1;
              return index < 0 ? counts[k] + index : index - 1;
            });
          const corners = tokens.slice(1).map(corner);
          for (let j = 1; j < corners.length - 1; j++) {
            faces.push(...corners[0], ...corners[j], ...corners[j + 1]);
          }
          break;
        }
        case "g":
          name = tokens[1];
          break;
      }
    }

    const object3d = Object3D.from_faces({
      vertices: vertices,
      uvs: uvs,
      normals: normals,
      faces: faces,
      name: name,
      crease_angle,
    });

    return object3d;
  }
  static async #load_image_file(data, as_image = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        if (!as_image) {
          const image = {
            data: ctx.getImageData(0, 0, img.width, img.height),
            width: img.width,
            height: img.height,
            name: data.name,
          };
          resolve(image);
        } else {
          resolve(img);
        }
      };
      img.onerror = () => reject(new Error(`Could not load image ${data.url}`));
      img.src = data.url;
    });
  }
  static async #load_audio_file(data_path) {
    const audio_data = await fetch(data_path);
    const buffer = await audio_data.arrayBuffer();
    return buffer;
  }

  static #removeEmptyStrings(data) {
    let dataOut = [];
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i].replace(/\t/g, "");
      if (data[i] !== "") dataOut.push(data[i]);
    }
    return dataOut;
  }
  static #cleanString(data) {
    return data.replace(/\t/g, "");
  }
}

Resources.DATA = null;
