// Geometry helpers for the world builder: polygon triangulation, meshes
// (with flat normals) and the .usda writer.

// Signed area of a ring of [x, z] points (positive = clockwise seen from
// above, since z points south).
export function ring_area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

// Removes the closing duplicate, repeated points and (nearly) collinear points.
export function clean_ring(points, eps = 0.05) {
  let ring = points.slice();
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < eps) ring.pop();
  }
  let changed = true;
  while (changed && ring.length >= 3) {
    changed = false;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[(i + ring.length - 1) % ring.length], c = ring[i], n = ring[(i + 1) % ring.length];
      const cross = (c[0] - p[0]) * (n[1] - p[1]) - (c[1] - p[1]) * (n[0] - p[0]);
      const len = Math.hypot(n[0] - p[0], n[1] - p[1]);
      if (Math.hypot(c[0] - p[0], c[1] - p[1]) < eps || Math.abs(cross) < eps * len) {
        ring.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return ring;
}

// Ear clipping. Returns triangles as index triplets into `ring`, in the
// ring's own winding. O(n^2), fine for footprints and coastlines.
export function triangulate(ring) {
  const n = ring.length;
  if (n < 3) return [];
  const sign = ring_area(ring) > 0 ? 1 : -1;
  const idx = [...Array(n).keys()];
  const tris = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => {
    const d1 = cross(a, b, p) * sign, d2 = cross(b, c, p) * sign, d3 = cross(c, a, p) * sign;
    return d1 > 0 && d2 > 0 && d3 > 0;
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = ring[ia], b = ring[ib], c = ring[ic];
      // Convex corner (same turn as the whole ring)?
      if (cross(a, b, c) * sign <= 0) continue;
      let ear = true;
      for (const k of idx) {
        if (k === ia || k === ib || k === ic) continue;
        if (inside(ring[k], a, b, c)) {
          ear = false;
          break;
        }
      }
      if (!ear) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // self-intersecting ring: give up on the rest
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// A mesh being built: shared points (to the millimetre), one flat normal per
// triangle, indexed UVs.
export class Mesh {
  points = [];
  #point_index = new Map();
  faces = []; // point indices, 3 per triangle
  normals = []; // 3 floats per triangle
  uvs = [];
  #uv_index = new Map();
  uv_faces = []; // uv indices, 3 per triangle
  min = [1e30, 1e30, 1e30];
  max = [-1e30, -1e30, -1e30];

  constructor(name, material) {
    this.name = name;
    this.material = material;
  }
  get triangles() {
    return this.faces.length / 3;
  }

  #point(p) {
    const key = `${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)}`;
    let i = this.#point_index.get(key);
    if (i === undefined) {
      i = this.points.length;
      this.points.push([+p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3)]);
      this.#point_index.set(key, i);
      for (let k = 0; k < 3; k++) {
        this.min[k] = Math.min(this.min[k], p[k]);
        this.max[k] = Math.max(this.max[k], p[k]);
      }
    }
    return i;
  }
  #uv(uv) {
    const key = `${uv[0].toFixed(4)},${uv[1].toFixed(4)}`;
    let i = this.#uv_index.get(key);
    if (i === undefined) {
      i = this.uvs.length;
      this.uvs.push([+uv[0].toFixed(4), +uv[1].toFixed(4)]);
      this.#uv_index.set(key, i);
    }
    return i;
  }

  // A triangle of [x, y, z] points; its front face is counter-clockwise
  // (right-handed). With `facing` ([x, y, z]), the winding is flipped if
  // needed so the normal points that way. uv: one [u, v] or one per corner.
  // `normal` replaces the triangle's own normal: for small pieces of a
  // bigger plane, whose rounded points would give a slightly different one.
  tri(a, b, c, uv, facing = null, normal = null) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-6) return;
    const uvs = Array.isArray(uv[0]) ? [...uv] : [uv, uv, uv];
    if (facing && nx * facing[0] + ny * facing[1] + nz * facing[2] < 0) {
      [b, c] = [c, b];
      uvs.splice(1, 2, uvs[2], uvs[1]);
      nx = -nx, ny = -ny, nz = -nz;
    }
    this.faces.push(this.#point(a), this.#point(b), this.#point(c));
    this.uv_faces.push(this.#uv(uvs[0]), this.#uv(uvs[1]), this.#uv(uvs[2]));
    if (normal) this.normals.push(+normal[0].toFixed(3), +normal[1].toFixed(3), +normal[2].toFixed(3));
    else this.normals.push(+(nx / len).toFixed(3), +(ny / len).toFixed(3), +(nz / len).toFixed(3));
  }
  // Quad a b c d (in order around it).
  quad(a, b, c, d, uv, facing = null) {
    const uvs = Array.isArray(uv[0]) ? uv : [uv, uv, uv, uv];
    this.tri(a, b, c, [uvs[0], uvs[1], uvs[2]], facing);
    this.tri(a, c, d, [uvs[0], uvs[2], uvs[3]], facing);
  }
}

const UP = [0, 1, 0];
export { UP };

// Flat polygon (ring of [x, z]) at height y, facing up.
export function add_polygon(mesh, ring, y, uv) {
  for (const [a, b, c] of triangulate(ring)) {
    mesh.tri([ring[a][0], y, ring[a][1]], [ring[b][0], y, ring[b][1]], [ring[c][0], y, ring[c][1]], uv, UP);
  }
}

// --- USDA ---------------------------------------------------------------

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(v));
const tuples = (list) => list.map((t) => `(${t.map(fmt).join(", ")})`).join(", ");

function material_usda(name, texture) {
  const m = `/World/Looks/${name}`;
  return `        def Material "${name}"
        {
            token outputs:surface.connect = <${m}/surface.outputs:surface>
            def Shader "surface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = <${m}/texture.outputs:rgb>
                float inputs:roughness = 1
                token outputs:surface
            }
            def Shader "texture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${texture}@
                float2 inputs:st.connect = <${m}/reader.outputs:result>
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float3 outputs:rgb
            }
            def Shader "reader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 outputs:result
            }
        }
`;
}

function mesh_usda(mesh) {
  return `        def Mesh "${mesh.name}" (
            prepend apiSchemas = ["MaterialBindingAPI"]
        )
        {
            float3[] extent = [(${mesh.min.map((v) => v.toFixed(2)).join(", ")}), (${mesh.max.map((v) => v.toFixed(2)).join(", ")})]
            int[] faceVertexCounts = [${new Array(mesh.triangles).fill(3).join(", ")}]
            int[] faceVertexIndices = [${mesh.faces.join(", ")}]
            point3f[] points = [${tuples(mesh.points)}]
            normal3f[] normals = [${tuples(chunks(mesh.normals, 3))}] (
                interpolation = "uniform"
            )
            texCoord2f[] primvars:st = [${tuples(mesh.uvs)}] (
                interpolation = "faceVarying"
            )
            int[] primvars:st:indices = [${mesh.uv_faces.join(", ")}]
            uniform token subdivisionScheme = "none"
            rel material:binding = </World/Looks/${mesh.material}>
        }
`;
}
const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// materials: { name: texture path relative to the .usda file }
export function write_usda(meshes, materials, doc) {
  const looks = Object.entries(materials)
    .map(([name, texture]) => material_usda(name, texture))
    .join("");
  return `#usda 1.0
(
    defaultPrim = "World"
    doc = "${doc}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "World"
{
    def Scope "Looks"
    {
${looks}    }

    def Scope "Geometry"
    {
${meshes.filter((m) => m.triangles).map(mesh_usda).join("\n")}    }
}
`;
}
