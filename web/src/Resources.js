import AudioTrack from "./AudioTrack.js";
import Object3D from "./Object3D.js";
import Texture from "./Texture.js";
import WASM from "./WASM.js";

export default class Resources {
  static objects = [];
  static textures = [];
  static audios = [];
  static splash = null;
  static main_audio = null;

  static async initialize(listener, state) {
    if (listener) listener(state, "loading data.json");
    const raw_data = await Resources.#load_json_data("resources/data.json");

    for (let i = 0; i < raw_data.images.length; i++) {
      if (listener) listener(state, `loading image: ${raw_data.images[i].name}`);
      const image_data = await Resources.#load_image_file(raw_data.images[i]);

      const t_buffer = WASM.set_texture_buffer(image_data.width, image_data.height, i);

      const texture = new Texture(image_data, t_buffer, i);
      Resources.textures.push(texture);
    }

    for (let i = 0; i < raw_data.meshes.length; i++) {
      if (listener) listener(state, `loading object: ${raw_data.meshes[i].name}`);

      const split_data = raw_data.meshes[i].url.split(".");
      const obj_type = split_data[split_data.length - 1];
      let obj_data;
      switch (obj_type) {
        case "obj":
          obj_data = await Resources.#load_obj_file(raw_data.meshes[i].url);
          break;
        case "fbx":
          obj_data = await Resources.#load_fbx_file(raw_data.meshes[i].url);
          break;
      }
      obj_data.texture = Resources.get_image(raw_data.meshes[i].texture);
      Resources.objects.push(obj_data);
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

  static get_object(obj_name) {
    const obj = Resources.objects.find((obj) => obj.name === obj_name).clone();
    return obj;
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

  static async #load_fbx_file(data_path) {
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
      clean_data
    );

    const uvs_index = parse_block(clean_data.search("UVIndex:"), clean_data);
    const uvs = parse_block(clean_data.search("UV:"), clean_data);

    const normals = [];
    for (let i = 0; i < vertices_index.length; i++) {
      const val = vertices_index[i];
      if (val < 0) {
        vertices_index[i] = Math.abs(parseInt(vertices_index[i] + 1));
      }
      normals.push(1);

      faces.push(vertices_index[i]);
      faces.push(uvs_index[i]);
      faces.push(1);
    }

    const name_index = clean_data.search("Model: ");
    let name_data = "";
    for (let i = name_index; i < clean_data.length; i++) {
      const char = clean_data[i];
      if (char === "\n") break;
      name_data += char;
    }
    const name = name_data.split(", ")[1].replace(/['"]/g, "").replace("Model::", "");

    const object3d = Resources.#make_fan_strip({
      vertices: vertices,
      uvs: uvs,
      normals: normals,
      faces: faces,
      name: name,
    });

    return object3d;
  }
  static async #load_obj_file(data_path) {
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

    const object3d = Resources.#make_fan_strip({
      vertices: vertices,
      uvs: uvs,
      normals: normals,
      faces: faces,
      name: name,
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
      img.src = data.url;
    });
  }
  static async #load_audio_file(data_path) {
    const audio_data = await fetch(data_path);
    const buffer = await audio_data.arrayBuffer();
    return buffer;
  }

  // Expands indexed faces (v, uv, normal index triplets) into flat
  // per-triangle arrays. Missing/invalid indices produce zeros.
  static #make_fan_strip(mesh_data) {
    const expand = (source, size, offset) => {
      const out = new Float32Array((mesh_data.faces.length / 3) * size);
      for (let i = 0, o = 0; i < mesh_data.faces.length; i += 3, o += size) {
        const index = mesh_data.faces[i + offset];
        if (index < 0 || (index + 1) * size > source.length) continue;
        for (let k = 0; k < size; k++) out[o + k] = source[index * size + k];
      }
      return out;
    };

    return new Object3D({
      vertices: expand(mesh_data.vertices, 3, 0),
      uvs: expand(mesh_data.uvs, 2, 1),
      normals: expand(mesh_data.normals, 3, 2),
      name: mesh_data.name,
      texture: mesh_data.texture,
    });
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
