// The world's relief: a height grid made from SRTM elevation data, and the
// tools to lay flat map features (land, roads, water) over it.
//
// The ground is a regular grid of square cells, each split in two triangles
// by the diagonal from its (x0, z0) corner to its (x1, z1) corner:
//
//   (i, j) ---- (i+1, j)        x ->
//     | \   A   |               z (south)
//     |   \     |               |
//     | B   \   |               v
//   (i, j+1) -- (i+1, j+1)
//
// Heights are linear inside each triangle. The game reads the same grid from
// map.json and interpolates it the same way (src/WorldMap.js), so anything
// draped here sits exactly on the ground the car drives on.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

// An SRTM .hgt tile (1 arc-second: 3601 x 3601 big-endian int16, rows from
// north to south), optionally gzipped. `lat`, `lon`: its south-west corner.
export function read_hgt(path, lat, lon) {
  let raw = readFileSync(path);
  if (raw[0] === 0x1f && raw[1] === 0x8b) raw = gunzipSync(raw);
  const n = Math.round(Math.sqrt(raw.length / 2));
  if (n * n * 2 !== raw.length) throw new Error(`${path}: not a square .hgt file`);
  const at = (r, c) => {
    const v = raw.readInt16BE((Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))) * 2);
    return v < -1000 ? 0 : v; // voids
  };
  return {
    // Metres above sea level at (lat, lon), bilinear.
    sample(la, lo) {
      const r = (lat + 1 - la) * (n - 1), c = (lo - lon) * (n - 1);
      const r0 = Math.floor(r), c0 = Math.floor(c), fr = r - r0, fc = c - c0;
      return (at(r0, c0) * (1 - fc) + at(r0, c0 + 1) * fc) * (1 - fr) + (at(r0 + 1, c0) * (1 - fc) + at(r0 + 1, c0 + 1) * fc) * fr;
    },
  };
}

// Keeps the part of a convex polygon where a*x + b*z + c >= 0. Points are
// [x, z, u, v]; new points on the cut get interpolated u, v.
function clip(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
    if (dp >= 0) out.push(p);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, p[3] + (q[3] - p[3]) * t]);
    }
  }
  return out;
}
const area2 = (poly) => {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(a);
};

export class Terrain {
  // heights: (nx + 1) * (nz + 1) node heights, row by row (z), metres.
  constructor(x0, z0, cell, nx, nz, heights) {
    Object.assign(this, { x0, z0, cell, nx, nz, heights });
  }
  node(i, j) {
    return this.heights[j * (this.nx + 1) + i];
  }

  // The cell (x, z) is in (clamped to the grid) and its position inside it.
  #locate(x, z) {
    const gx = (x - this.x0) / this.cell, gz = (z - this.z0) / this.cell;
    const i = Math.min(this.nx - 1, Math.max(0, Math.floor(gx)));
    const j = Math.min(this.nz - 1, Math.max(0, Math.floor(gz)));
    return [i, j, Math.min(1, Math.max(0, gx - i)), Math.min(1, Math.max(0, gz - j))];
  }
  // Height in triangle A (upper = true) or B of cell (i, j), at (fx, fz) in the cell.
  #plane(i, j, upper, fx, fz) {
    const h00 = this.node(i, j), h11 = this.node(i + 1, j + 1);
    if (upper) {
      const h10 = this.node(i + 1, j);
      return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    }
    const h01 = this.node(i, j + 1);
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }
  // Unit normal of that triangle.
  #normal(i, j, upper) {
    const dx = this.#plane(i, j, upper, 1, 0) - this.#plane(i, j, upper, 0, 0);
    const dz = this.#plane(i, j, upper, 0, 1) - this.#plane(i, j, upper, 0, 0);
    const len = Math.hypot(dx, this.cell, dz);
    return [-dx / len, this.cell / len, -dz / len];
  }

  // Ground height at (x, z).
  height(x, z) {
    const [i, j, fx, fz] = this.#locate(x, z);
    return this.#plane(i, j, fx >= fz, fx, fz);
  }

  // Lays a triangle (or any convex polygon) of [x, z, u, v] points over the
  // ground: it is cut along the grid's lines, and emit(points, normal) gets
  // each piece, a convex polygon of [x, y, z, u, v] on one ground triangle,
  // with that triangle's unit normal. `lift` is added to y. With `cells` (a Set of cell keys, see
  // cell_key), only the parts over those cells are laid.
  drape(tri, lift, emit, cells = null) {
    const { x0, z0, cell } = this;
    const xs = tri.map((p) => p[0]), zs = tri.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / cell)), i1 = Math.min(this.nx - 1, Math.floor((Math.max(...xs) - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - z0) / cell)), j1 = Math.min(this.nz - 1, Math.floor((Math.max(...zs) - z0) / cell));
    for (let i = i0; i <= i1; i++) {
      const cx = x0 + i * cell;
      const column = i0 === i1 ? tri : clip(clip(tri, 1, 0, -cx), -1, 0, cx + cell);
      if (column.length < 3) continue;
      for (let j = j0; j <= j1; j++) {
        if (cells && !cells.has(this.cell_key(i, j))) continue;
        const cz = z0 + j * cell;
        const square = j0 === j1 ? column : clip(clip(column, 0, 1, -cz), 0, -1, cz + cell);
        if (square.length < 3) continue;
        // A: x - cx >= z - cz. B: the other side of the diagonal.
        for (const upper of [true, false]) {
          const piece = upper ? clip(square, 1, -1, cz - cx) : clip(square, -1, 1, cx - cz);
          if (piece.length < 3 || area2(piece) < 2e-4) continue;
          const points = piece.map(([x, z, u, v]) =>
            [x, this.#plane(i, j, upper, (x - cx) / cell, (z - cz) / cell) + lift, z, u, v]);
          emit(points, this.#normal(i, j, upper));
        }
      }
    }
  }
  cell_key(i, j) {
    return j * this.nx + i;
  }

  // Lays a polygon (a ring of [x, z], already triangulated: `tris` are index
  // triplets) with one uv. Cells the polygon covers whole give two clean
  // triangles; only the ones its outline crosses get cut pieces.
  drape_polygon(ring, tris, uv, lift, emit) {
    const { x0, z0, cell } = this;
    // The cells the outline goes through: each stretch of an edge between
    // two grid lines is in one cell.
    const edge_cells = new Set();
    for (let k = 0; k < ring.length; k++) {
      const pts = this.split(ring[k], ring[(k + 1) % ring.length]);
      for (let s = 0; s + 1 < pts.length; s++) {
        const x = (pts[s][0] + pts[s + 1][0]) / 2, z = (pts[s][1] + pts[s + 1][1]) / 2;
        // The neighbours too, for an edge on (or very near) a grid line.
        for (const ex of [-0.002, 0.002])
          for (const ez of [-0.002, 0.002]) {
            const i = Math.floor((x - x0) / cell + ex), j = Math.floor((z - z0) / cell + ez);
            if (i >= 0 && i < this.nx && j >= 0 && j < this.nz) edge_cells.add(this.cell_key(i, j));
          }
      }
    }
    const inside = (x, z) => {
      let c = false;
      for (let k = 0, l = ring.length - 1; k < ring.length; l = k++) {
        const a = ring[k], b = ring[l];
        if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    };
    const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / cell)), i1 = Math.min(this.nx - 1, Math.floor((Math.max(...xs) - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - z0) / cell)), j1 = Math.min(this.nz - 1, Math.floor((Math.max(...zs) - z0) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (edge_cells.has(this.cell_key(i, j))) continue;
        const cx = x0 + i * cell, cz = z0 + j * cell;
        if (!inside(cx + cell / 2, cz + cell / 2)) continue;
        const P = (di, dj) => [cx + di * cell, this.node(i + di, j + dj) + lift, cz + dj * cell, uv[0], uv[1]];
        emit([P(0, 0), P(1, 0), P(1, 1)], this.#normal(i, j, true));
        emit([P(0, 0), P(1, 1), P(0, 1)], this.#normal(i, j, false));
      }
    for (const [a, b, c] of tris)
      this.drape([a, b, c].map((k) => [ring[k][0], ring[k][1], uv[0], uv[1]]), lift, emit, edge_cells);
  }

  // The points of segment a-b ([x, z]) where the ground changes slope: a, b
  // and every crossing of a grid line or diagonal in between, in order.
  split(a, b) {
    const { x0, z0, cell } = this;
    const ts = [0, 1];
    const cross = (fa, fb) => {
      // The line where f is a whole number, for f going from fa to fb.
      for (let k = Math.ceil(Math.min(fa, fb)); k <= Math.floor(Math.max(fa, fb)); k++)
        if (fa !== fb) ts.push((k - fa) / (fb - fa));
    };
    const ax = (a[0] - x0) / cell, az = (a[1] - z0) / cell, bx = (b[0] - x0) / cell, bz = (b[1] - z0) / cell;
    cross(ax, bx);
    cross(az, bz);
    cross(ax - az, bx - bz);
    const sorted = ts.filter((t) => t >= 0 && t <= 1).sort((p, q) => p - q);
    const out = [];
    let last = -1;
    for (const t of sorted) {
      if (t - last < 1e-6) continue;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      last = t;
    }
    return out;
  }
}

// Builds the height grid.
//   dem:    read_hgt()
//   proj:   osm.mjs projection()
//   bounds: { x0, z0, x1, z1 } world area to cover (snapped out to whole cells)
//   cell:   metres
//   is_land(x, z): false over the sea (the data there is not reliable)
//   floor:  lowest ground height; also the height given to the sea's cells,
//           so the land comes down to it at the coast
//   smooth: metres (gaussian sigma): SRTM is a noisy surface model (it has
//           the buildings and trees in it)
//   roads:  [{ pts: [[x, z], ...] }] lines the ground is levelled around:
//           within `flat` metres of one the ground takes the road's height,
//           so it doesn't tilt sideways on a slope; from there it blends
//           back into the relief up to `blend` metres.
//           The road's height is one profile along the longest line (the
//           others run beside it and take its height): the relief under it,
//           averaged over `ease` metres each way, which turns the steps of
//           the data into the long, even ramps of a real road.
export function build_terrain(dem, proj, bounds, cell, { is_land, floor = 2, smooth = 40, roads = [], flat = 65, blend = 150, ease = 200 }) {
  const x0 = Math.floor(bounds.x0 / cell) * cell, z0 = Math.floor(bounds.z0 / cell) * cell;
  const nx = Math.ceil((bounds.x1 - x0) / cell), nz = Math.ceil((bounds.z1 - z0) / cell);

  // Sample on a lattice twice as fine as the grid, with a margin for the blur.
  const step = cell / 2, sigma = smooth / step, reach = Math.ceil(sigma * 3);
  const w = nx * 2 + 1 + reach * 2, h = nz * 2 + 1 + reach * 2;
  let lattice = new Float64Array(w * h);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const x = x0 + (c - reach) * step, z = z0 + (r - reach) * step;
      const [lat, lon] = proj.to_latlon(x, z);
      lattice[r * w + c] = is_land(x, z) ? Math.max(floor, dem.sample(lat, lon)) : floor;
    }
  // Separable gaussian blur.
  const kernel = [];
  for (let k = -reach; k <= reach; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const total = kernel.reduce((s, v) => s + v, 0);
  for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const out = new Float64Array(w * h);
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        let sum = 0;
        for (let k = -reach; k <= reach; k++) {
          const rr = Math.min(h - 1, Math.max(0, r + dr * k)), cc = Math.min(w - 1, Math.max(0, c + dc * k));
          sum += lattice[rr * w + cc] * kernel[k + reach];
        }
        out[r * w + c] = sum / total;
      }
    lattice = out;
  }
  const heights = new Float64Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) heights[j * (nx + 1) + i] = lattice[(j * 2 + reach) * w + i * 2 + reach];
  const relief = new Terrain(x0, z0, cell, nx, nz, heights);

  // Level the ground around the roads.
  // Closest point of a line to (x, z): { d: distance, k, t: segment and position in it, x, z }.
  const closest = (pts, x, z) => {
    const best = { d: 1e30, k: 0, t: 0, x: 0, z: 0 };
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
      const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) Object.assign(best, { d, k, t, x: px, z: pz });
    }
    return best;
  };
  const levelled = new Float64Array(heights);
  if (roads.length) {
    const length = (pts) => pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0);
    const main = roads.reduce((best, r) => (length(r.pts) > length(best.pts) ? r : best)).pts;
    // The main line's height profile, sampled every 10 m of its length.
    const samples = []; // [distance along the line, relief]
    const starts = [0]; // distance along the line at each of its points
    for (let k = 0; k + 1 < main.length; k++) {
      const a = main[k], b = main[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 10));
      for (let s = 0; s < n; s++) {
        const t = s / n;
        samples.push([starts[k] + len * t, relief.height(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)]);
      }
      starts.push(starts[k] + len);
    }
    samples.push([starts.at(-1), relief.height(...main.at(-1))]);
    const profile = (dist) => {
      let sum = 0, weight = 0;
      for (const [d, y] of samples) {
        const wgt = 1 - Math.abs(d - dist) / ease;
        if (wgt > 0) (sum += y * wgt), (weight += wgt);
      }
      return sum / weight;
    };
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = x0 + i * cell, z = z0 + j * cell;
        // The nearest road, and the main line's height beside that place.
        const near = roads.map((r) => closest(r.pts, x, z)).reduce((a, b) => (b.d < a.d ? b : a));
        if (near.d >= blend) continue;
        const at = closest(main, near.x, near.z);
        const y = profile(starts[at.k] + (starts[at.k + 1] - starts[at.k]) * at.t);
        let t = Math.min(1, (blend - near.d) / (blend - flat));
        t = t * t * (3 - 2 * t);
        const n = j * (nx + 1) + i;
        levelled[n] = heights[n] + (y - heights[n]) * t;
      }
  }
  // To the centimetre: map.json stores whole centimetres, and both sides
  // must agree on the ground.
  for (let n = 0; n < levelled.length; n++) levelled[n] = Math.round(levelled[n] * 100) / 100;
  return new Terrain(x0, z0, cell, nx, nz, levelled);
}
