// Reader for USD ASCII files (.usda), the text form of Universal Scene
// Description. It covers what a real-time renderer needs:
//
//   - Mesh prims: points, faceVertexCounts/Indices (polygons are split into
//     triangle fans), holeIndices, orientation, and UVs/normals as primvars
//     with any interpolation, indexed or not.
//   - The Xform hierarchy. Every xformOp, including !invert! and
//     !resetXformStack!, is baked into the vertices, because a Gizmo object
//     has a single transform.
//   - upAxis "Z", converted to Gizmo's Y-up.
//   - Variant sets: the selected variant is applied.
//   - Materials: the diffuseColor of a UsdPreviewSurface, either a constant or
//     a UsdUVTexture file. A mesh split into material GeomSubsets yields one
//     mesh per subset.
//
// Unsupported features are reported through `warn` and skipped: references,
// payloads, sublayers, inherits/specializes, instancing, non-Mesh gprims
// (Cube, Sphere...) and animation, for which the first time sample is used.
// Binary .usdc and .usdz are not read here.

export default class USDA {
  // Parses .usda text and returns plain mesh data:
  // [{ name, path, vertices, uvs, normals, faces, material }]
  // `faces` holds (point, uv, normal) index triplets, three per triangle, as
  // the OBJ loader produces. A missing uv or normal is -1. `material` is
  // { texture: asset path | null, color: [r, g, b] linear | null } or null.
  static load(text, warn = () => {}) {
    return extract_meshes(USDA.parse(text), warn);
  }

  // Returns the layer's pseudo-root prim:
  // { spec, type, name, path, meta, attrs: Map, rels: Map, children, variantSets }
  static parse(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (!/^#usda\s/.test(text)) {
      throw new Error(
        text.startsWith("PXR-USDC")
          ? "binary USD (usdc) is not supported yet, only .usda"
          : "not a .usda file (missing #usda header)"
      );
    }
    return new Parser(text).layer();
  }
}

/////////
// Lexer
/////////

const RE_NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
// Namespaced names (primvars:st), property suffixes (.connect) and array
// types (float3[]) are read as a single identifier.
const RE_IDENT = /[A-Za-z_][\w:.]*(?:\[\])?/y;
const PUNCT = "()[]{}=,;:";

class Lexer {
  #text;
  #pos = 0;
  #tok = null;
  constructor(text) {
    this.#text = text;
  }

  error(message, at = this.#tok ? this.#tok.at : this.#pos) {
    let line = 1;
    for (let i = this.#text.indexOf("\n"); i >= 0 && i < at; i = this.#text.indexOf("\n", i + 1)) line++;
    return new Error(`usda line ${line}: ${message}`);
  }

  peek() {
    return (this.#tok ??= this.#scan());
  }
  next() {
    const t = this.peek();
    this.#tok = null;
    return t;
  }
  is(type, value) {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }
  accept(type, value) {
    return this.is(type, value) ? this.next() : null;
  }
  expect(type, value) {
    const t = this.next();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      const found = t.type === "eof" ? "end of file" : JSON.stringify(t.value);
      throw this.error(`expected ${value ?? type}, found ${found}`, t.at);
    }
    return t;
  }

  #scan() {
    const s = this.#text;
    let i = this.#pos;
    // Whitespace and comments: # ..., // ..., /* ... */
    for (;;) {
      const c = s.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else if (c === 35 || (c === 47 && s.charCodeAt(i + 1) === 47)) {
        const end = s.indexOf("\n", i);
        i = end < 0 ? s.length : end;
      } else if (c === 47 && s.charCodeAt(i + 1) === 42) {
        const end = s.indexOf("*/", i + 2);
        if (end < 0) throw this.error("unterminated comment", i);
        i = end + 2;
      } else break;
    }

    const at = i;
    let type, value;
    const c = s[i];
    if (i >= s.length) {
      type = "eof";
      value = null;
    } else if (PUNCT.includes(c)) {
      type = "punct";
      value = c;
      i++;
    } else if (c === '"' || c === "'") {
      type = "str";
      [value, i] = this.#string(i);
    } else if (c === "@") {
      // @path@ or @@@path@@@
      const fence = s.startsWith("@@@", i) ? "@@@" : "@";
      const end = s.indexOf(fence, i + fence.length);
      if (end < 0) throw this.error("unterminated asset path", i);
      type = "asset";
      value = s.slice(i + fence.length, end);
      i = end + fence.length;
    } else if (c === "<") {
      const end = s.indexOf(">", i);
      if (end < 0) throw this.error("unterminated path", i);
      type = "path";
      value = s.slice(i + 1, end).trim();
      i = end + 1;
    } else {
      RE_NUMBER.lastIndex = i;
      let m = RE_NUMBER.exec(s);
      if (m) {
        type = "num";
        value = Number(m[0]);
        i += m[0].length;
      } else if ((c === "-" || c === "+") && s.startsWith("inf", i + 1)) {
        type = "num";
        value = c === "-" ? -Infinity : Infinity;
        i += 4;
      } else {
        RE_IDENT.lastIndex = i;
        m = RE_IDENT.exec(s);
        if (!m) throw this.error(`unexpected character ${JSON.stringify(c)}`, i);
        type = "id";
        value = m[0];
        i += m[0].length;
      }
    }
    this.#pos = i;
    return { type, value, at };
  }

  // "...", '...', """...""" or '''...'''
  #string(i) {
    const s = this.#text;
    const q = s[i];
    const triple = q + q + q;
    let start, end, next;
    if (s.startsWith(triple, i)) {
      start = i + 3;
      end = s.indexOf(triple, start);
      if (end < 0) throw this.error("unterminated string", i);
      next = end + 3;
    } else {
      start = i + 1;
      end = start;
      while (end < s.length && s[end] !== q && s[end] !== "\n") end += s[end] === "\\" ? 2 : 1;
      if (s[end] !== q) throw this.error("unterminated string", i);
      next = end + 1;
    }
    const raw = s.slice(start, end);
    const value = raw.includes("\\")
      ? raw.replace(/\\(.)/gs, (_, ch) => ({ n: "\n", t: "\t", r: "\r" })[ch] ?? ch)
      : raw;
    return [value, next];
  }
}

/////////
// Parser
/////////

const SPECIFIERS = new Set(["def", "over", "class"]);
const LIST_OPS = new Set(["prepend", "append", "add", "delete", "reorder"]);
const QUALIFIERS = new Set(["custom", "uniform", "varying", "config", "prepend", "append", "add", "delete"]);
const PROPERTY_FIELDS = new Set(["connect", "timeSamples", "spline", "default"]);

const new_prim = (spec, type, name, path) => ({
  spec,
  type,
  name,
  path,
  meta: {},
  attrs: new Map(),
  rels: new Map(),
  children: [],
  variantSets: null,
});

class Parser {
  #lex;
  constructor(text) {
    this.#lex = new Lexer(text);
  }

  layer() {
    const lex = this.#lex;
    const root = new_prim("def", "", "", "/");
    if (lex.is("punct", "(")) root.meta = this.#metadata();
    while (!lex.is("eof")) {
      const t = lex.peek();
      if (t.type !== "id" || !SPECIFIERS.has(t.value)) throw lex.error(`expected a prim, found ${JSON.stringify(t.value)}`);
      root.children.push(this.#prim(root));
    }
    return root;
  }

  // def Xform "name" ( metadata ) { body }
  #prim(parent) {
    const lex = this.#lex;
    const spec = lex.next().value;
    const type = lex.is("id") ? lex.next().value : "";
    const name = lex.expect("str").value;
    const prim = new_prim(spec, type, name, parent.path === "/" ? `/${name}` : `${parent.path}/${name}`);
    if (lex.is("punct", "(")) prim.meta = this.#metadata();
    lex.expect("punct", "{");
    this.#body(prim);
    if (prim.variantSets) apply_variants(prim, prim.variantSets, prim.meta.variants);
    return prim;
  }

  // Reads up to and including the closing "}".
  #body(prim) {
    const lex = this.#lex;
    while (!lex.accept("punct", "}")) {
      if (lex.accept("punct", ";")) continue;
      const t = lex.peek();
      if (t.type !== "id") throw lex.error(`unexpected ${JSON.stringify(t.value)}`);
      if (SPECIFIERS.has(t.value)) prim.children.push(this.#prim(prim));
      else if (t.value === "variantSet") this.#variant_set(prim);
      else if (t.value === "reorder") {
        // reorder nameChildren = [...] / reorder properties = [...]
        lex.next();
        lex.expect("id");
        lex.expect("punct", "=");
        this.#value();
      } else this.#property(prim);
    }
  }

  // variantSet "name" = { "a" ( metadata ) { body } "b" { body } }
  #variant_set(prim) {
    const lex = this.#lex;
    lex.next();
    const set_name = lex.expect("str").value;
    lex.expect("punct", "=");
    lex.expect("punct", "{");
    const set = ((prim.variantSets ??= {})[set_name] ??= {});
    while (!lex.accept("punct", "}")) {
      const variant = new_prim("def", prim.type, prim.name, prim.path);
      const name = lex.expect("str").value;
      if (lex.is("punct", "(")) variant.meta = this.#metadata();
      lex.expect("punct", "{");
      this.#body(variant);
      set[name] = variant;
    }
  }

  // [custom] [uniform] type name[.connect|.timeSamples] [= value] [( metadata )]
  // [custom] rel name [= target(s)] [( metadata )]
  #property(prim) {
    const lex = this.#lex;
    while (lex.is("id") && QUALIFIERS.has(lex.peek().value)) lex.next();
    const head = lex.expect("id").value;

    if (head === "rel") {
      const name = lex.expect("id").value.replace(/\.default$/, "");
      const rel = prim.rels.get(name) ?? { targets: undefined, meta: {} };
      prim.rels.set(name, rel);
      if (lex.accept("punct", "=")) rel.targets ??= to_paths(this.#value());
      if (lex.is("punct", "(")) Object.assign(rel.meta, this.#metadata());
      return;
    }

    const full_name = lex.expect("id").value;
    const dot = full_name.indexOf(".");
    const field = dot > 0 ? full_name.slice(dot + 1) : "default";
    if (!PROPERTY_FIELDS.has(field)) throw lex.error(`unknown property field "${full_name}"`);
    const name = dot > 0 ? full_name.slice(0, dot) : full_name;

    const attr = prim.attrs.get(name) ?? { type: head, value: undefined, connect: undefined, samples: undefined, meta: {} };
    prim.attrs.set(name, attr);
    if (lex.accept("punct", "=")) {
      if (field === "connect") attr.connect = to_paths(this.#value());
      else if (field === "timeSamples") attr.samples = this.#time_samples();
      else if (field === "spline") this.#skip_braces();
      else attr.value = this.#value();
    }
    if (lex.is("punct", "(")) Object.assign(attr.meta, this.#metadata());
  }

  // ( "doc" key = value prepend key = value ... )
  #metadata() {
    const lex = this.#lex;
    const meta = {};
    lex.expect("punct", "(");
    while (!lex.accept("punct", ")")) {
      if (lex.accept("punct", ";")) continue;
      const t = lex.next();
      if (t.type === "str") {
        meta.doc = t.value;
        continue;
      }
      if (t.type !== "id") throw lex.error(`unexpected ${JSON.stringify(t.value)} in metadata`, t.at);
      let key = t.value;
      if (LIST_OPS.has(key) && lex.is("id")) key = lex.next().value;
      meta[key] = lex.accept("punct", "=") ? this.#value() : true;
    }
    return meta;
  }

  #value() {
    const lex = this.#lex;
    const t = lex.next();
    switch (t.type) {
      case "num":
      case "str":
        return t.value;
      case "asset":
        return { asset: t.value };
      case "path":
        return { path: t.value };
      case "id":
        if (t.value === "None") return null;
        if (t.value === "true") return true;
        if (t.value === "false") return false;
        if (t.value === "inf") return Infinity;
        if (t.value === "nan") return NaN;
        return t.value;
      case "punct":
        if (t.value === "[") return this.#list("]");
        if (t.value === "(") return this.#list(")");
        if (t.value === "{") return this.#dictionary();
    }
    throw lex.error(`unexpected ${t.type === "eof" ? "end of file" : JSON.stringify(t.value)}`, t.at);
  }

  // Arrays [a, b] and tuples (a, b), after the opening bracket.
  #list(close) {
    const lex = this.#lex;
    const out = [];
    while (!lex.accept("punct", close)) {
      out.push(this.#value());
      if (!lex.accept("punct", ",")) {
        lex.expect("punct", close);
        break;
      }
    }
    return out;
  }

  // { type key = value ... }, after the opening brace.
  #dictionary() {
    const lex = this.#lex;
    const out = {};
    while (!lex.accept("punct", "}")) {
      if (lex.accept("punct", ";")) continue;
      lex.expect("id"); // value type
      const key = lex.next();
      if (key.type !== "id" && key.type !== "str") throw lex.error("expected a dictionary key", key.at);
      lex.expect("punct", "=");
      out[key.value] = this.#value();
    }
    return out;
  }

  // { time: value, ... } -> [[time, value], ...] sorted by time
  #time_samples() {
    const lex = this.#lex;
    const out = [];
    lex.expect("punct", "{");
    while (!lex.accept("punct", "}")) {
      const time = lex.expect("num").value;
      lex.expect("punct", ":");
      out.push([time, this.#value()]);
      lex.accept("punct", ",");
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  #skip_braces() {
    const lex = this.#lex;
    lex.expect("punct", "{");
    for (let depth = 1; depth > 0; ) {
      const t = lex.next();
      if (t.type === "eof") throw lex.error("unterminated block", t.at);
      if (t.type === "punct" && t.value === "{") depth++;
      if (t.type === "punct" && t.value === "}") depth--;
    }
  }
}

const to_paths = (value) => {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => v && typeof v.path === "string").map((v) => v.path);
};

// Merges the selected variants into the prim. Local opinions are stronger
// than variant opinions, so the variant only fills in what is missing.
const apply_variants = (prim, sets, selections) => {
  for (const [set_name, variants] of Object.entries(sets)) {
    const variant = variants[selections?.[set_name]];
    if (!variant) continue;
    merge_spec(prim, variant);
    if (variant.variantSets) apply_variants(prim, variant.variantSets, selections);
  }
};

const merge_spec = (dst, src) => {
  for (const [name, attr] of src.attrs) {
    const own = dst.attrs.get(name);
    if (!own) dst.attrs.set(name, attr);
    else {
      for (const field of ["value", "connect", "samples"]) own[field] ??= attr[field];
      own.meta = { ...attr.meta, ...own.meta };
    }
  }
  for (const [name, rel] of src.rels) {
    const own = dst.rels.get(name);
    if (!own) dst.rels.set(name, rel);
    else own.targets ??= rel.targets;
  }
  for (const child of src.children) {
    const own = dst.children.find((c) => c.name === child.name);
    if (own) merge_spec(own, child);
    else dst.children.push(child);
  }
};

/////////
// Matrices: 4x4, row-major, column vectors (p' = M * p)
/////////

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const mul = (a, b) => {
  const o = new Array(16);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + a[r * 4 + 3] * b[12 + c];
  return o;
};

const translation = ([x, y, z]) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
const scaling = ([x, y, z]) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];

const rotation = (axis, degrees) => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  if (axis === "X") return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  if (axis === "Y") return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

// USD quaternions are written (real, i, j, k).
const from_quaternion = ([w, x, y, z]) => {
  const n = Math.hypot(w, x, y, z) || 1;
  w /= n, x /= n, y /= n, z /= n;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 0,
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 0,
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
};

// USD writes matrices for row vectors (translation in the last row), so the
// transpose is what we need.
const from_usd_matrix = (rows) => {
  const f = rows.flat();
  const m = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) m[r * 4 + c] = f[c * 4 + r];
  return m;
};

const invert = (a) => {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
};

// Rows of the 3x3 cofactor matrix: (inverse transpose) * det. It maps
// normals, and its sign-corrected form keeps them pointing outwards.
const normal_matrix = (m) => {
  const r0 = [m[0], m[1], m[2]], r1 = [m[4], m[5], m[6]], r2 = [m[8], m[9], m[10]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const c0 = cross(r1, r2), c1 = cross(r2, r0), c2 = cross(r0, r1);
  const det = r0[0] * c0[0] + r0[1] * c0[1] + r0[2] * c0[2];
  const s = det < 0 ? -1 : 1;
  return { rows: [c0, c1, c2].map((r) => r.map((v) => v * s)), det };
};

const op_matrix = (kind, value) => {
  switch (kind) {
    case "translate":
      return translation(value);
    case "scale":
      return scaling(typeof value === "number" ? [value, value, value] : value);
    case "rotateX":
    case "rotateY":
    case "rotateZ":
      return rotation(kind[6], value);
    case "orient":
      return from_quaternion(value);
    case "transform":
      return from_usd_matrix(value);
  }
  // rotateXYZ, rotateZYX...: the value is always (x, y, z) angles; the name
  // gives the order, first letter applied first.
  const order = /^rotate([XYZ]{3})$/.exec(kind);
  if (!order) return null;
  let m = identity();
  for (const axis of order[1]) m = mul(rotation(axis, value["XYZ".indexOf(axis)]), m);
  return m;
};

/////////
// Stage -> meshes
/////////

const UV_TYPE = /^(texCoord2[fdh]|float2|double2|half2)\[\]$/;
const UV_NAMES = ["primvars:st", "primvars:st0", "primvars:UVMap", "primvars:uv"];
const ARCS = ["references", "payload", "inherits", "specializes"];
const BINDINGS = ["material:binding", "material:binding:preview", "material:binding:full"];
const OTHER_GPRIMS = new Set([
  "Cube", "Sphere", "Cylinder", "Cylinder_1", "Cone", "Capsule", "Capsule_1", "Plane",
  "Points", "BasisCurves", "NurbsCurves", "NurbsPatch", "HermiteCurves", "TetMesh", "PointInstancer",
]);

const numbers = (value) => {
  if (value == null) return null;
  return Array.isArray(value) ? value.flat(Infinity) : [value];
};

// Splits "/A/B.inputs:x" into prim path and property, resolving relative
// paths ("../Tex.outputs:rgb", ".inputs:x") against `base`.
const resolve_path = (path, base) => {
  const slash = path.lastIndexOf("/");
  const last = path.slice(slash + 1);
  let prim = path, prop = "";
  if (last !== "." && last !== "..") {
    const dot = last.indexOf(".", last.startsWith("..") ? 2 : 0);
    if (dot >= 0) {
      prim = path.slice(0, slash + 1 + dot);
      prop = last.slice(dot + 1);
    }
  }
  if (!prim.startsWith("/")) {
    const parts = base.split("/").filter(Boolean);
    for (const s of prim.split("/")) {
      if (s === "" || s === ".") continue;
      if (s === "..") parts.pop();
      else parts.push(s);
    }
    prim = "/" + parts.join("/");
  }
  return { prim, prop };
};

function extract_meshes(root, warn) {
  const index = new Map();
  const add_to_index = (prim) => {
    index.set(prim.path, prim);
    prim.children.forEach(add_to_index);
  };
  add_to_index(root);

  const warned = new Set();
  const warn_once = (message) => {
    if (warned.has(message)) return;
    warned.add(message);
    warn(message);
  };

  // Default value, else the first time sample (no animation support).
  const value_of = (prim, name) => {
    const attr = prim.attrs.get(name);
    if (!attr) return undefined;
    if (attr.value !== undefined) return attr.value ?? undefined;
    if (attr.samples?.length) {
      warn_once(`${prim.path}.${name} is animated, using its first time sample`);
      return attr.samples[0][1] ?? undefined;
    }
    return undefined;
  };

  if (root.meta.subLayers) warn("subLayers are not supported and were ignored");
  const up_axis = root.meta.upAxis ?? "Y";
  if (up_axis !== "Y" && up_axis !== "Z") warn(`unknown upAxis "${up_axis}", assuming Y`);
  // Z-up to Y-up: (x, y, z) -> (x, z, -y)
  const stage_matrix = up_axis === "Z" ? rotation("X", -90) : identity();

  const local_transform = (prim) => {
    const order = value_of(prim, "xformOpOrder");
    let m = identity(), reset = false;
    if (!Array.isArray(order)) return { m, reset };
    for (let op of order) {
      if (op === "!resetXformStack!") {
        reset = true;
        m = identity();
        continue;
      }
      const inverse = op.startsWith("!invert!");
      if (inverse) op = op.slice(8);
      const value = value_of(prim, op);
      let om = value === undefined ? null : op_matrix(op.split(":")[1], value);
      if (om && inverse) om = invert(om);
      if (!om) {
        warn_once(`${prim.path}: cannot evaluate ${op}, ignored`);
        continue;
      }
      m = mul(m, om);
    }
    return { m, reset };
  };

  const binding_of = (prim) => {
    for (const name of BINDINGS) {
      const target = prim.rels.get(name)?.targets?.[0];
      if (target) return resolve_path(target, prim.path).prim;
    }
    return null;
  };

  // Follows connections (through NodeGraphs and Material interfaces) until a
  // Shader output or a plain value.
  const follow = (prim, name, depth = 0) => {
    const attr = prim.attrs.get(name);
    if (!attr) return null;
    if (attr.connect?.length && depth < 32) {
      const { prim: path, prop } = resolve_path(attr.connect[0], prim.path);
      const target = index.get(path);
      if (!target) {
        warn_once(`${prim.path}.${name} connects to missing ${path}`);
        return null;
      }
      return target.type === "Shader" ? { shader: target, output: prop } : follow(target, prop, depth + 1);
    }
    const value = value_of(prim, name);
    return value === undefined ? null : { value };
  };

  const materials = new Map();
  const material_of = (path) => {
    if (!path) return null;
    if (materials.has(path)) return materials.get(path);
    let result = null;
    const material = index.get(path);
    const surface = material && follow(material, "outputs:surface");
    if (!material) warn_once(`material ${path} not found`);
    else if (value_of(surface?.shader ?? material, "info:id") !== "UsdPreviewSurface") {
      warn_once(`material ${path}: only UsdPreviewSurface is supported`);
    } else {
      result = { texture: null, color: [0.18, 0.18, 0.18] }; // the spec's default diffuseColor
      const diffuse = follow(surface.shader, "inputs:diffuseColor");
      if (diffuse?.shader) {
        const file = value_of(diffuse.shader, "inputs:file");
        if (value_of(diffuse.shader, "info:id") === "UsdUVTexture" && file?.asset) result.texture = file.asset;
        else warn_once(`material ${path}: diffuseColor comes from an unsupported shader`);
      } else if (diffuse) result.color = numbers(diffuse.value).slice(0, 3);
    }
    materials.set(path, result);
    return result;
  };

  // Resolves a primvar to (values, index function) per triangle corner.
  const primvar = (prim, name, size, sizes, transform) => {
    const attr = prim.attrs.get(name);
    let values = attr && numbers(value_of(prim, name));
    if (!values?.length) return null;
    if (transform) values = transform(values);
    const count = Math.floor(values.length / size);
    const indices = value_of(prim, `${name}:indices`);
    const elements = indices ? indices.length : count;
    let interpolation = attr.meta.interpolation;
    if (!interpolation) {
      // Not authored: guess from the element count.
      interpolation = Object.keys(sizes).find((k) => sizes[k] === elements) ?? "constant";
    }
    const pick = {
      constant: () => 0,
      uniform: (f) => f,
      vertex: (f, c, p) => p,
      varying: (f, c, p) => p,
      faceVarying: (f, c) => c,
    }[interpolation];
    if (!pick) {
      warn_once(`${prim.path}.${name}: unknown interpolation "${interpolation}"`);
      return null;
    }
    const index = indices
      ? (f, c, p) => {
          const i = indices[pick(f, c, p)];
          return i >= 0 && i < count ? i : -1;
        }
      : (f, c, p) => {
          const i = pick(f, c, p);
          return i >= 0 && i < count ? i : -1;
        };
    return { values, index };
  };

  const pick_uv_name = (prim) => {
    for (const name of UV_NAMES) if (prim.attrs.has(name)) return name;
    for (const [name, attr] of prim.attrs) {
      if (name.startsWith("primvars:") && !name.endsWith(":indices") && UV_TYPE.test(attr.type)) return name;
    }
    return null;
  };

  // One output mesh per material: GeomSubsets of the "materialBind" family
  // carve faces out of the mesh; the rest uses the mesh's own binding.
  const read_mesh = (prim, world, inherited_binding, out) => {
    const points = numbers(value_of(prim, "points"));
    const counts = value_of(prim, "faceVertexCounts");
    const indices = value_of(prim, "faceVertexIndices");
    if (!points?.length || !Array.isArray(counts) || !Array.isArray(indices)) {
      warn(`Mesh ${prim.path} skipped: no points or faces`);
      return;
    }
    const num_points = Math.floor(points.length / 3);

    const vertices = new Array(num_points * 3);
    for (let i = 0; i < num_points * 3; i += 3) {
      const x = points[i], y = points[i + 1], z = points[i + 2];
      vertices[i] = world[0] * x + world[1] * y + world[2] * z + world[3];
      vertices[i + 1] = world[4] * x + world[5] * y + world[6] * z + world[7];
      vertices[i + 2] = world[8] * x + world[9] * y + world[10] * z + world[11];
    }

    const { rows, det } = normal_matrix(world);
    const transform_normals = (n) => {
      const out = new Array(n.length);
      for (let i = 0; i + 2 < n.length; i += 3) {
        const x = n[i], y = n[i + 1], z = n[i + 2];
        const nx = rows[0][0] * x + rows[0][1] * y + rows[0][2] * z;
        const ny = rows[1][0] * x + rows[1][1] * y + rows[1][2] * z;
        const nz = rows[2][0] * x + rows[2][1] * y + rows[2][2] * z;
        const len = Math.hypot(nx, ny, nz) || 1;
        out[i] = nx / len, out[i + 1] = ny / len, out[i + 2] = nz / len;
      }
      return out;
    };

    const sizes = { faceVarying: indices.length, vertex: num_points, uniform: counts.length };
    const uv_name = pick_uv_name(prim);
    const uv = uv_name && primvar(prim, uv_name, 2, sizes);
    const normals = prim.attrs.has("primvars:normals")
      ? primvar(prim, "primvars:normals", 3, sizes, transform_normals)
      : primvar(prim, "normals", 3, sizes, transform_normals);

    // Mirroring transforms and left-handed meshes reverse the front face.
    const flip = (value_of(prim, "orientation") === "leftHanded") !== det < 0;
    const holes = new Set(value_of(prim, "holeIndices") ?? []);

    // Face -> group (material subset); -1 for the rest of the mesh.
    const subsets = prim.children.filter(
      (c) => c.type === "GeomSubset" && c.spec === "def" && value_of(c, "familyName") === "materialBind"
    );
    const face_group = new Int32Array(counts.length).fill(-1);
    subsets.forEach((subset, g) => {
      for (const f of value_of(subset, "indices") ?? []) if (f >= 0 && f < counts.length) face_group[f] = g;
    });
    const groups = [
      ...subsets.map((s) => ({ name: s.name, binding: binding_of(s), faces: [] })),
      { name: null, binding: binding_of(prim) ?? inherited_binding, faces: [] },
    ];
    const rest = groups.length - 1;

    let corner = 0, bad = 0;
    for (let f = 0; f < counts.length; f++) {
      const n = counts[f];
      if (n >= 3 && !holes.has(f) && corner + n <= indices.length) {
        const faces = groups[face_group[f] < 0 ? rest : face_group[f]].faces;
        for (let j = 1; j < n - 1; j++) {
          const a = corner, b = corner + (flip ? j + 1 : j), c = corner + (flip ? j : j + 1);
          for (const k of [a, b, c]) {
            let p = indices[k];
            if (!(p >= 0 && p < num_points)) (p = -1), bad++;
            faces.push(p, uv ? uv.index(f, k, p) : -1, normals ? normals.index(f, k, p) : -1);
          }
        }
      }
      corner += n;
    }
    if (corner !== indices.length) warn(`Mesh ${prim.path}: faceVertexCounts don't match faceVertexIndices`);
    if (bad) warn(`Mesh ${prim.path}: ${bad} out-of-range point indices`);

    const used = groups.filter((g) => g.faces.length);
    for (const group of used) {
      out.push({
        name: used.length > 1 && group.name ? `${prim.name}_${group.name}` : prim.name,
        path: group.name ? `${prim.path}/${group.name}` : prim.path,
        vertices,
        uvs: uv ? uv.values : [],
        normals: normals ? normals.values : [],
        faces: group.faces,
        material: material_of(group.binding),
      });
    }
  };

  const meshes = [];
  const visit = (prim, parent_world, inherited_binding) => {
    for (const child of prim.children) {
      if (child.spec !== "def") {
        if (child.spec === "over") warn_once(`over ${child.path} ignored (composition is not supported)`);
        continue;
      }
      for (const arc of ARCS) {
        if (child.meta[arc] !== undefined) warn_once(`${arc} on ${child.path} ignored (composition is not supported)`);
      }
      if (child.variantSets && !child.meta.variants) warn_once(`${child.path} has variant sets but no selection`);
      if (value_of(child, "visibility") === "invisible") continue;
      const purpose = value_of(child, "purpose");
      if (purpose === "guide" || purpose === "proxy") continue;

      const { m, reset } = local_transform(child);
      const world = mul(reset ? stage_matrix : parent_world, m);
      const binding = binding_of(child) ?? inherited_binding;

      if (child.type === "Mesh") read_mesh(child, world, inherited_binding, meshes);
      else if (OTHER_GPRIMS.has(child.type)) warn_once(`${child.type} ${child.path} skipped: only Mesh is supported`);
      visit(child, world, binding);
    }
  };
  visit(root, stage_matrix, null);

  // Object names must be unique to be found by name; fall back to the path.
  const seen = new Map();
  for (const mesh of meshes) seen.set(mesh.name, (seen.get(mesh.name) ?? 0) + 1);
  for (const mesh of meshes) if (seen.get(mesh.name) > 1) mesh.name = mesh.path.slice(1);

  return meshes;
}
