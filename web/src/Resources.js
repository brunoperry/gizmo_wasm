import AudioTrack from "./AudioTrack.js";
import Object3D from "./Object3D.js";
import Texture from "./Texture.js";
import WASM from "./WASM.js";
import USDA from "./USDA.js";
import Animator from "./Animator.js";
import { DEFAULT_CREASE_ANGLE } from "./Normals.js";

export default class Resources {
  // Models are loaded when first needed (load_model) and kept here, as JS
  // data. Their textures go into wasm memory per scene (texture_id).
  static objects = []; // every loaded mesh, from all loaded models
  static textures = []; // the current scene's textures (wasm), by id
  static audios = [];
  static splash = null;
  static main_audio = null;
  static #models = new Map(); // data.json entry name -> its meshes
  static #loading = new Map(); // data.json entry name -> Promise (while loading)
  static #images = new Map(); // url or name -> image ({ name, width, height, data })
  static #scene_textures = new Map(); // image -> Texture in the current scene
  static #clips = new Map(); // data.json entry name -> { clip: [start, end] }

  // Files load_files() accepts as the model.
  static MODEL_TYPES = ["usda", "usd", "usdc", "usdz", "obj", "fbx"];

  // Reads data.json and loads the models marked "preload": true (the ones a
  // scene built in code needs right away, see TestScene). The others load
  // when picked (load_model).
  static async initialize(listener, state) {
    if (listener) listener(state, "loading data.json");
    const raw_data = await Resources.#load_json_data("resources/data.json");
    Resources.DATA = raw_data;

    for (const entry of raw_data.meshes) {
      if (!entry.preload) continue;
      if (listener) listener(state, `loading object: ${entry.name}`);
      await Resources.load_model(entry.name);
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
  }

  // Loads a data.json model (once: later calls return right away). Then
  // get_objects(name) gives instances of it.
  static async load_model(name) {
    if (Resources.#models.has(name)) return;
    if (!Resources.#loading.has(name)) {
      const entry = Resources.DATA?.meshes.find((m) => m.name === name);
      if (!entry) throw new Error(`No model "${name}" in data.json`);
      const task = Resources.#load_entry(entry).finally(() => Resources.#loading.delete(name));
      Resources.#loading.set(name, task);
    }
    await Resources.#loading.get(name);
  }
  static is_loaded(name) {
    return Resources.#models.has(name);
  }
  static async #load_entry(entry) {
    const url = new URL(entry.url, document.baseURI);
    const context = Resources.#url_context(url, entry.url, entry.crease_angle);
    const loaded = await Resources.#parse_model(entry.url, await Resources.#load_text_data(url), context);
    const texture = entry.texture ? await Resources.#named_image(entry.texture) : undefined;
    // A USD file can hold several meshes; get_objects(entry.name) returns them all.
    for (const obj of loaded) {
      if (texture) obj.texture = texture;
      obj.group = entry.name;
      Resources.objects.push(obj);
    }
    if (entry.clips) Resources.#clips.set(entry.name, entry.clips);
    Resources.#models.set(entry.name, loaded);
  }
  // An image of data.json's "images" list, by name.
  static async #named_image(name) {
    const info = Resources.DATA.images.find((image) => image.name === name);
    if (!info) throw new Error(`No image "${name}" in data.json`);
    return Resources.#url_image(new URL(info.url, document.baseURI).href, name);
  }
  static async #url_image(url, name = url) {
    if (!Resources.#images.has(url)) {
      Resources.#images.set(url, await Resources.#load_image_file({ name, url }));
    }
    return Resources.#images.get(url);
  }

  static get_object(obj_name) {
    const obj = Resources.objects.find((obj) => obj.name === obj_name);
    if (!obj) {
      if (Resources.DATA?.meshes.some((m) => m.name === obj_name)) Resources.#not_loaded(obj_name);
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
    const sources = Resources.#models.get(entry_name);
    if (!sources) Resources.#not_loaded(entry_name);
    return Resources.#animate(sources, sources.map((obj) => obj.clone()));
  }
  static #not_loaded(name) {
    throw new Error(
      `Model "${name}" isn't loaded: await Resources.load_model("${name}") first, ` +
        `or add "preload": true to its data.json entry`
    );
  }
  // Loads a model picked from the computer. `files` holds the model (.usda,
  // .obj, .fbx) and whatever it refers to: textures, an OBJ's .mtl. They are
  // matched by relative path, then by file name. A lone image goes on the
  // meshes that end up without a texture. Returns { name, objects, warnings }.
  static async load_files(files) {
    files = [...files];
    const extension = (file) => file.name.split(".").pop().toLowerCase();
    const model = files.find((file) => Resources.MODEL_TYPES.includes(extension(file)));
    if (!model) throw new Error("No model among the files (.usda, .obj or .fbx)");

    const warnings = [];
    const warn = (message) => {
      warnings.push(message);
      console.warn(`${model.name}: ${message}`);
    };
    const context = Resources.#files_context(files, warn);
    const objects = await Resources.#parse_model(model.name, await model.text(), context);

    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 1 && objects.some((obj) => !obj.texture)) {
      const texture = await context.texture(images[0].name);
      for (const obj of objects) obj.texture ??= texture;
    }

    const name = model.name.replace(/\.[^.]+$/, "");
    for (const obj of objects) obj.group = name;
    Resources.#animate(objects, objects);
    return { name, objects, warnings };
  }

  // The wasm texture id of an image in the current scene (created the first
  // time), or -1 for none. Called when an object is added to the scene.
  static texture_id(image) {
    if (!image) return -1;
    if (image instanceof Texture) image = image.image;
    let texture = Resources.#scene_textures.get(image);
    if (!texture) {
      const id = Resources.textures.length;
      texture = new Texture(image, WASM.set_texture_buffer(image.width, image.height, id), id);
      Resources.textures.push(texture);
      Resources.#scene_textures.set(image, texture);
    }
    return texture.id;
  }

  // The scene was cleared (WASM.scene_clear): its textures are gone.
  static scene_cleared() {
    Resources.textures.length = 0;
    Resources.#scene_textures.clear();
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
  // A loaded image (see data.json "images"), or undefined.
  static get_image(image_name) {
    return [...Resources.#images.values()].find((image) => image.name === image_name);
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

  static #parse_fbx(data, crease_angle) {
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
  // A model file's text -> Object3Ds. `path` gives the format (extension).
  // The context (see #url_context, #files_context) finds what the file
  // refers to: textures, an OBJ's material library.
  static async #parse_model(path, text, context) {
    const type = path.split(".").pop().toLowerCase();
    switch (type) {
      case "obj": {
        const { object, libraries, materials } = Resources.#parse_obj(text, context.crease_angle);
        if (context.read_text) object.texture = await Resources.#obj_texture(libraries, materials, context);
        return [object];
      }
      case "fbx":
        return [Resources.#parse_fbx(text, context.crease_angle)];
      case "usda":
      case "usd":
        if (text.startsWith("PXR-USDC")) throw new Error(`${path}: binary USD (usdc) isn't supported yet, only .usda`);
        return Resources.#parse_usd(text, context);
      case "usdc":
      case "usdz":
        throw new Error(`${path}: .${type} isn't supported yet, only .usda`);
      default:
        throw new Error(`Unsupported model format: ${path}`);
    }
  }

  // Textures of models from data.json: loaded relative to the model's URL
  // and kept (JS only), like the models.
  static #url_context(base_url, label, crease_angle) {
    const warn = (message) => console.warn(`${label}: ${message}`);
    return {
      warn,
      crease_angle,
      texture: async (path) => {
        try {
          return await Resources.#url_image(new URL(path, base_url).href);
        } catch (error) {
          warn(`could not load texture ${path}`);
        }
      },
      color_texture: (rgb) => {
        const image = Resources.#color_image(rgb);
        if (!Resources.#images.has(image.name)) Resources.#images.set(image.name, image);
        return Resources.#images.get(image.name);
      },
    };
  }

  // Textures of models picked from the computer: looked up among the picked files.
  static #files_context(files, warn) {
    const by_path = new Map();
    for (const file of files) {
      by_path.set(file.name.toLowerCase(), file);
      if (file.webkitRelativePath) by_path.set(file.webkitRelativePath.toLowerCase(), file);
    }
    const find = (path) => {
      const clean = path.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
      return by_path.get(clean) ?? by_path.get(clean.split("/").pop());
    };
    const images = new Map(); // file or color name -> image
    return {
      warn,
      crease_angle: DEFAULT_CREASE_ANGLE,
      read_text: async (path) => (await find(path)?.text()) ?? null,
      texture: async (path) => {
        const file = find(path);
        if (!file) {
          warn(`texture ${path} not found: pick it together with the model`);
          return undefined;
        }
        if (!images.has(file)) {
          const url = URL.createObjectURL(file);
          try {
            images.set(file, await Resources.#load_image_file({ name: file.name, url }));
          } catch (error) {
            warn(`could not load texture ${file.name}`);
            images.set(file, undefined);
          } finally {
            URL.revokeObjectURL(url);
          }
        }
        return images.get(file);
      },
      color_texture: (rgb) => {
        const image = Resources.#color_image(rgb);
        if (!images.has(image.name)) images.set(image.name, image);
        return images.get(image.name);
      },
    };
  }

  // .usda (USD ASCII). Each Mesh prim becomes an Object3D named after the
  // prim, with its transform hierarchy baked in. Its texture comes from the
  // bound UsdPreviewSurface: the diffuse texture file, or a 1x1 texture of
  // the diffuse color. A "texture" in data.json overrides it.
  static async #parse_usd(text, context) {
    const meshes = USDA.load(text, context.warn);
    if (!meshes.length) context.warn("no meshes found");

    const objects = [];
    for (const mesh of meshes) {
      const obj = Object3D.from_faces({ ...mesh, crease_angle: context.crease_angle });
      obj.texture = await Resources.#usd_texture(mesh.material, context);
      objects.push(obj);
    }
    return objects;
  }
  static async #usd_texture(material, context) {
    if (!material) return undefined;
    if (material.texture) {
      if (material.texture.includes("<UDIM>")) {
        context.warn(`UDIM textures are not supported: ${material.texture}`);
      } else {
        const texture = await context.texture(material.texture);
        if (texture) return texture;
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
    return context.color_texture(material.color.map(srgb));
  }
  // A 1x1 image of an sRGB color (0..255 each).
  static #color_image(rgb) {
    return {
      name: `usd-color:${rgb.join(",")}`,
      width: 1,
      height: 1,
      data: new ImageData(new Uint8ClampedArray([...rgb, 255]), 1, 1),
    };
  }
  // The diffuse texture (map_Kd) of an OBJ's materials: the first material
  // used that has one, else the first in the library.
  static async #obj_texture(libraries, materials, context) {
    for (const library of libraries) {
      const text = await context.read_text(library);
      if (text === null) {
        context.warn(`material library ${library} not found: pick it together with the model`);
        continue;
      }
      const maps = new Map(); // material -> texture path
      let current = null;
      for (const line of text.split("\n")) {
        const tokens = line.trim().split(/\s+/);
        if (tokens[0] === "newmtl") current = tokens.slice(1).join(" ");
        else if (tokens[0] === "map_Kd" && current !== null && tokens.length > 1) {
          maps.set(current, tokens[tokens.length - 1]); // options come before the file
        }
      }
      const material = materials.find((m) => maps.has(m)) ?? maps.keys().next().value;
      if (material !== undefined) return context.texture(maps.get(material));
    }
    return undefined;
  }

  // Returns { object, libraries, materials }: the .mtl files it names and the
  // materials it uses, in order.
  static #parse_obj(data, crease_angle) {
    const lines = data.split("\n");
    const libraries = [];
    const materials = [];
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
        case "mtllib":
          libraries.push(...tokens.slice(1).map((t) => t.trim()).filter(Boolean));
          break;
        case "usemtl":
          materials.push(tokens.slice(1).join(" ").trim());
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

    return { object: object3d, libraries, materials };
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
