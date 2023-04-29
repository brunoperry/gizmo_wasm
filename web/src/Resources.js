import Object3D from "./Object3D.js";
import Texture from "./Texture.js";

export default class Resources {
  static objects = [];
  static images = [];
  static audios = [];
  static splash = null;
  static main_audio = null;

  static async initialize(listener, state) {
    if (listener) listener(state, "loading data.json");
    const raw_data = await Resources.#load_json_data("resources/data.json");

    for (let i = 0; i < raw_data.images.length; i++) {
      if (listener) listener(state, `loading image: ${raw_data.images[i].name}`);
      const image_data = await Resources.#load_image_file(raw_data.images[i]);
      Resources.images.push(image_data);
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
        case "gltf":
          obj_data = await Resources.#load_gltf_file(raw_data.meshes[i].url);
          break;
      }
      obj_data.texture = new Texture(raw_data.meshes[i].texture);
      Resources.objects.push(obj_data);
    }
  }

  static get_object(obj_name) {
    return Resources.objects.find((obj) => obj.name === obj_name);
  }
  static get_image(image_name) {
    return Resources.images.find((image) => image.name === image_name);
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
        case "f":
          for (let j = 0; j < tokens.length - 3; j++) {
            const tk1 = tokens[1].split("/");
            const tk2 = tokens[2].split("/");
            const tk3 = tokens[3].split("/");

            faces.push(parseInt(tk1[0] - 1));
            faces.push(parseInt(tk1[1] - 1));
            faces.push(parseInt(tk1[2] - 1));

            faces.push(parseInt(tk2[0] - 1));
            faces.push(parseInt(tk2[1] - 1));
            faces.push(parseInt(tk2[2] - 1));

            faces.push(parseInt(tk3[0] - 1));
            faces.push(parseInt(tk3[1] - 1));
            faces.push(parseInt(tk3[2] - 1));
          }
          break;
        case "g":
        case "o":
          name = tokens[1];
          break;
      }
    }

    const objOut = Resources.#make_fan_strip({
      vertices: vertices,
      uvs: uvs,
      normals: normals,
      faces: faces,
      name: name,
    });

    return objOut;
  }
  static async #load_gltf_file(data_path) {
    const response = await fetch(data_path);
    const data = await response.json();
    const meshData = data.meshes[0];
    return new Object3D(data);
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

  static #make_fan_strip(mesh_data) {
    let vecs = new Array(mesh_data.vertices.length / 3);
    let v_counter = 0;
    for (let i = 0; i < mesh_data.vertices.length; i += 3) {
      vecs[v_counter] = [
        mesh_data.vertices[i],
        mesh_data.vertices[i + 1],
        mesh_data.vertices[i + 2],
      ];
      v_counter++;
    }

    let fanned_vecs = [];
    for (let i = 0; i < mesh_data.faces.length; i += 3) {
      const a_index = mesh_data.faces[i];
      fanned_vecs.push(...vecs[a_index]);
    }

    let uvs = new Array(mesh_data.uvs.length / 2);
    let uv_counter = 0;
    for (let i = 0; i < mesh_data.uvs.length; i += 2) {
      uvs[uv_counter] = [mesh_data.uvs[i], mesh_data.uvs[i + 1]];
      uv_counter++;
    }

    let fanned_uvs = [];
    for (let i = 0; i < mesh_data.faces.length; i += 3) {
      const a_index = mesh_data.faces[i + 1];
      fanned_uvs.push(...uvs[a_index]);
    }

    let normals = new Array(mesh_data.normals.length / 3);

    let normal_counter = 0;
    for (let i = 0; i < mesh_data.normals.length; i += 3) {
      normals[normal_counter] = [
        mesh_data.normals[i],
        mesh_data.normals[i + 1],
        mesh_data.normals[i + 2],
      ];
      normal_counter++;
    }
    let fanned_normals = [];
    for (let i = 0; i < mesh_data.faces.length; i += 3) {
      const a_index = mesh_data.faces[i + 2];

      fanned_normals.push(...normals[a_index]);
    }
    return {
      vertices: fanned_vecs,
      uvs: fanned_uvs,
      normals: fanned_normals,
      name: mesh_data.name,
      texture: mesh_data.texture,
    };
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
