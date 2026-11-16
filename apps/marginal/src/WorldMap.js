// The game's view of the world, taken from the world's meshes as they were
// loaded (the .usda files, which may have been edited in Maya, Blender...).
// What a mesh is for comes from its name, or the name of a group it is in
// (the deepest one that matches; case doesn't matter):
//   ground*  the car drives on it (its height); its palette color says how:
//            asphalt, off-road or water (see palette.json)
//   road*    the car drives on it, always asphalt
//   solid*   the car hits it: its triangles are cut at WALL_HEIGHT above the
//            ground into wall segments (seen from above)
//   spawn*   where the car starts: a triangle pointing the way it faces
//            (hidden in the game)
//   anything else is only seen.
// Where there's no ground (the sea, past the world's end) or there's water,
// the car can't go: it is pushed back as from a wall.
//
// Lookups go through uniform grids, so a query only checks what's near.

export const Surface = { OFFROAD: 0, ASPHALT: 1, WATER: 2 };
const KINDS = ["ground", "road", "solid", "spawn"];
const SURFACE_NAMES = { asphalt: Surface.ASPHALT, water: Surface.WATER, offroad: Surface.OFFROAD };

const CELL = 8; // metres, the grids' cells
// Indices of the items whose bounds [x0, z0, x1, z1] touch each cell, packed.
class Grid {
  constructor(bounds) {
    let x0 = 1e30, z0 = 1e30, x1 = -1e30, z1 = -1e30;
    for (let i = 0; i < bounds.length; i += 4) {
      x0 = Math.min(x0, bounds[i]), z0 = Math.min(z0, bounds[i + 1]);
      x1 = Math.max(x1, bounds[i + 2]), z1 = Math.max(z1, bounds[i + 3]);
    }
    if (x0 > x1) x0 = z0 = x1 = z1 = 0;
    this.x0 = Math.floor(x0 / CELL);
    this.z0 = Math.floor(z0 / CELL);
    this.nx = Math.floor(x1 / CELL) - this.x0 + 1;
    this.nz = Math.floor(z1 / CELL) - this.z0 + 1;
    const range = (i) => [
      Math.floor(bounds[i] / CELL) - this.x0, Math.floor(bounds[i + 1] / CELL) - this.z0,
      Math.floor(bounds[i + 2] / CELL) - this.x0, Math.floor(bounds[i + 3] / CELL) - this.z0,
    ];
    // Counts, then offsets, then the items.
    this.start = new Int32Array(this.nx * this.nz + 1);
    const each = (fn) => {
      for (let i = 0; i < bounds.length; i += 4) {
        const [ax, az, bx, bz] = range(i);
        for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) fn(z * this.nx + x, i / 4);
      }
    };
    each((c) => this.start[c + 1]++);
    for (let c = 0; c < this.nx * this.nz; c++) this.start[c + 1] += this.start[c];
    this.items = new Int32Array(this.start[this.nx * this.nz]);
    const fill = this.start.slice(0, -1);
    each((c, item) => (this.items[fill[c]++] = item));
  }
  // The cell of (x, z): its items are items[start[c]] .. items[start[c + 1] - 1]; -1 if outside.
  cell(x, z) {
    const cx = Math.floor(x / CELL) - this.x0, cz = Math.floor(z / CELL) - this.z0;
    return cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz ? -1 : cz * this.nx + cx;
  }
}

// Closest point of segment (ax, az)-(bx, bz) to (x, z): [px, pz].
const closest = (x, z, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return [ax + dx * t, az + dz * t];
};

// What a mesh is for (see above): "ground", "road", "solid", "spawn" or null.
export function mesh_kind(object) {
  const names = (object.path ?? object.name ?? "").split("/").reverse();
  for (const name of names) {
    const lower = name.toLowerCase();
    const kind = KINDS.find((k) => lower.startsWith(k));
    if (kind) return kind;
  }
  return null;
}

export default class WorldMap {
  static WALL_HEIGHT = 0.5; // metres above the ground where solids are cut into walls
  static WALL_REACH = 2.5; // walls this far above or below the car's ground don't touch it
  static PROBES = 12; // directions checked around a circle for water / no ground

  // Ground: triangles (9 floats: x y z of 3 corners) and their surface.
  #tris;
  #surface;
  #ground;
  // Walls: segments (4 floats: x0 z0 x1 z1) and the height they were cut at.
  #walls;
  #wall_y;
  #wall_grid;

  // objects: the world's meshes (Object3D, with their path and texture).
  // palette: palette.json (which palette texel is which surface).
  // map: map.json (attribution, the EN6's route, the default spawn).
  constructor(objects, palette, map) {
    this.data = map;
    this.attribution = map.attribution;
    const by_kind = { ground: [], road: [], solid: [], spawn: [] };
    for (const obj of objects) by_kind[mesh_kind(obj)]?.push(obj);
    this.counts = Object.fromEntries(Object.entries(by_kind).map(([k, list]) => [k, list.length]));

    this.#build_ground([...by_kind.ground, ...by_kind.road], palette);
    this.#build_walls(by_kind.solid);
    this.spawn = WorldMap.#spawn_of(by_kind.spawn[0]) ?? map.spawn;
  }

  // --- Ground ---

  #build_ground(objects, palette) {
    let count = 0;
    for (const obj of objects) count += obj.vertices.length / 9;
    const tris = (this.#tris = new Float32Array(count * 9));
    const surface = (this.#surface = new Uint8Array(count));
    const bounds = new Float32Array(count * 4);
    // Palette texel -> surface.
    const texel_surface = new Uint8Array(palette.size * palette.size); // OFFROAD = 0
    for (const [name, i] of Object.entries(palette.colors))
      texel_surface[i] = SURFACE_NAMES[palette.surfaces[name]] ?? Surface.OFFROAD;

    let t = 0;
    for (const obj of objects) {
      const v = obj.vertices, uv = obj.uvs;
      const texture = obj.texture?.name ?? "";
      const is_road = mesh_kind(obj) === "road" || texture.endsWith("/road.png");
      const is_palette = texture.endsWith("/palette.png");
      for (let k = 0; k < v.length / 9; k++, t++) {
        tris.set(v.subarray(k * 9, k * 9 + 9), t * 9);
        const o = t * 9;
        bounds[t * 4] = Math.min(tris[o], tris[o + 3], tris[o + 6]);
        bounds[t * 4 + 1] = Math.min(tris[o + 2], tris[o + 5], tris[o + 8]);
        bounds[t * 4 + 2] = Math.max(tris[o], tris[o + 3], tris[o + 6]);
        bounds[t * 4 + 3] = Math.max(tris[o + 2], tris[o + 5], tris[o + 8]);
        if (is_road) surface[t] = Surface.ASPHALT;
        else if (is_palette && uv.length) {
          // The texel under the triangle's middle (images run top to bottom).
          const u = (uv[k * 6] + uv[k * 6 + 2] + uv[k * 6 + 4]) / 3, w = (uv[k * 6 + 1] + uv[k * 6 + 3] + uv[k * 6 + 5]) / 3;
          const n = palette.size, wrap = (a) => ((a % n) + n) % n;
          surface[t] = texel_surface[wrap(Math.floor((1 - w) * n)) * n + wrap(Math.floor(u * n))];
        }
      }
    }
    this.#ground = new Grid(bounds);
  }

  // The ground's top triangle at (x, z) no higher than y_max, or -1. Sets #hit_y.
  #hit_y = 0;
  #top(x, z, y_max) {
    const c = this.#ground.cell(x, z);
    if (c < 0) return -1;
    const t = this.#tris, items = this.#ground.items;
    let best = -1, best_y = -1e30;
    for (let k = this.#ground.start[c], end = this.#ground.start[c + 1]; k < end; k++) {
      const o = items[k] * 9;
      const ax = t[o], az = t[o + 2], bx = t[o + 3], bz = t[o + 5], cx = t[o + 6], cz = t[o + 8];
      const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      if (area * area < 1e-8) continue; // vertical
      // Barycentric weights, with a little tolerance so seams between triangles have no holes.
      const wb = ((x - ax) * (cz - az) - (z - az) * (cx - ax)) / area;
      const wc = ((bx - ax) * (z - az) - (bz - az) * (x - ax)) / area;
      const wa = 1 - wb - wc;
      if (wa < -1e-3 || wb < -1e-3 || wc < -1e-3) continue;
      const y = t[o + 1] * wa + t[o + 4] * wb + t[o + 7] * wc;
      if (y <= y_max && y > best_y) (best = items[k]), (best_y = y);
    }
    this.#hit_y = best_y;
    return best;
  }

  // Height of the ground at (x, z): the highest surface no higher than
  // y_max (to drive under a bridge, give the car's height + a step), or
  // null where there's none.
  height(x, z, y_max = 1e30) {
    return this.#top(x, z, y_max) < 0 ? null : this.#hit_y;
  }
  // Surface.* at (x, z) (as height()), or null where there's no ground.
  surface(x, z, y_max = 1e30) {
    const i = this.#top(x, z, y_max);
    return i < 0 ? null : this.#surface[i];
  }
  // Whether (x, z) is asphalt rather than off-road.
  on_road(x, z, y_max = 1e30) {
    return this.surface(x, z, y_max) === Surface.ASPHALT;
  }
  // Where the car can't go: water, or no ground at all.
  blocked(x, z, y_max = 1e30) {
    const s = this.surface(x, z, y_max);
    return s === null || s === Surface.WATER;
  }

  // --- Walls ---

  #build_walls(objects) {
    const segs = [], ys = [];
    const cut = [0, 0, 0, 0];
    for (const obj of objects) {
      const v = obj.vertices;
      for (let o = 0; o < v.length; o += 9) {
        const mx = (v[o] + v[o + 3] + v[o + 6]) / 3, mz = (v[o + 2] + v[o + 5] + v[o + 8]) / 3;
        const ground = this.height(mx, mz);
        if (ground === null) continue; // over the sea: nothing to drive into
        const y = ground + WorldMap.WALL_HEIGHT;
        // Where the triangle's edges cross y.
        let n = 0;
        for (let e = 0; e < 3 && n < 4; e++) {
          const a = o + e * 3, b = o + ((e + 1) % 3) * 3;
          const ya = v[a + 1] - y, yb = v[b + 1] - y;
          if ((ya < 0) === (yb < 0)) continue;
          const s = ya / (ya - yb);
          cut[n++] = v[a] + (v[b] - v[a]) * s;
          cut[n++] = v[a + 2] + (v[b + 2] - v[a + 2]) * s;
        }
        if (n < 4 || Math.hypot(cut[2] - cut[0], cut[3] - cut[1]) < 0.01) continue;
        segs.push(cut[0], cut[1], cut[2], cut[3]);
        ys.push(y);
      }
    }
    this.#walls = Float32Array.from(segs);
    this.#wall_y = Float32Array.from(ys);
    const bounds = new Float32Array(this.#walls.length);
    for (let i = 0; i < this.#walls.length; i += 4) {
      const w = this.#walls;
      bounds[i] = Math.min(w[i], w[i + 2]), bounds[i + 1] = Math.min(w[i + 1], w[i + 3]);
      bounds[i + 2] = Math.max(w[i], w[i + 2]), bounds[i + 3] = Math.max(w[i + 1], w[i + 3]);
    }
    this.#wall_grid = new Grid(bounds);
  }
  get wall_count() {
    return this.#wall_y.length;
  }

  // Pushes a circle (x, z, r), of a car whose ground is at y, out of the
  // walls and off water / the world's edge. Returns the push { x, z, nx, nz }
  // (nx, nz: the unit direction it was pushed in), or null if it touched nothing.
  collide(x, z, r, y = this.height(x, z) ?? 0) {
    let px = 0, pz = 0, hit = false;
    const g = this.#wall_grid, w = this.#walls;
    // A few passes: being pushed out of one wall can push into another.
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      const seen = new Set(); // a segment can be in several cells
      const cx = x + px, cz = z + pz;
      for (let gz = Math.floor((cz - r) / CELL); gz <= Math.floor((cz + r) / CELL); gz++)
        for (let gx = Math.floor((cx - r) / CELL); gx <= Math.floor((cx + r) / CELL); gx++) {
          const c = g.cell(gx * CELL, gz * CELL);
          if (c < 0) continue;
          for (let k = g.start[c]; k < g.start[c + 1]; k++) {
            const i = g.items[k];
            if (seen.has(i)) continue;
            seen.add(i);
            if (Math.abs(this.#wall_y[i] - WorldMap.WALL_HEIGHT - y) > WorldMap.WALL_REACH) continue;
            const qx0 = x + px, qz0 = z + pz;
            const [qx, qz] = closest(qx0, qz0, w[i * 4], w[i * 4 + 1], w[i * 4 + 2], w[i * 4 + 3]);
            const dx = qx0 - qx, dz = qz0 - qz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            let d = Math.sqrt(d2), nx, nz;
            if (d > 1e-6) (nx = dx / d), (nz = dz / d);
            else {
              // Centre right on the wall: push along the wall's normal.
              const ex = w[i * 4 + 2] - w[i * 4], ez = w[i * 4 + 3] - w[i * 4 + 1];
              const len = Math.hypot(ex, ez) || 1;
              (nx = -ez / len), (nz = ex / len), (d = 0);
            }
            px += nx * (r - d);
            pz += nz * (r - d);
            hit = moved = true;
          }
        }
      if (!moved) break;
    }
    const edge = this.#edge_push(x + px, z + pz, r, y);
    if (edge) (px += edge[0]), (pz += edge[1]), (hit = true);
    if (!hit) return null;
    const len = Math.hypot(px, pz) || 1;
    return { x: px, z: pz, nx: px / len, nz: pz / len };
  }

  // Water and the world's edge: probes around the circle; if some are
  // blocked, the push that takes the circle's rim back to the free side.
  #edge_push(x, z, r, y) {
    const y_max = y + 1; // a step up the car can take
    const N = WorldMap.PROBES;
    let sx = 0, sz = 0, any = false;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * 2 * Math.PI, dx = Math.cos(a), dz = Math.sin(a);
      if (this.blocked(x + dx * r, z + dz * r, y_max)) (sx += dx), (sz += dz), (any = true);
    }
    if (!any) return null;
    let len = Math.hypot(sx, sz);
    if (len < 1e-6) return null; // blocked all round (a gap narrower than the car): leave it
    const dx = sx / len, dz = sz / len; // towards the blocked side
    if (this.blocked(x, z, y_max)) {
      // The centre is in: step back until it's out, then a radius more.
      for (let d = 0.25; d <= 4; d += 0.25)
        if (!this.blocked(x - dx * d, z - dz * d, y_max)) return [-dx * (d + r), -dz * (d + r)];
      return null;
    }
    // The edge's distance along that direction (bisection), then out by what's missing.
    let lo = 0, hi = r;
    if (!this.blocked(x + dx * r, z + dz * r, y_max)) {
      // Not blocked straight that way (a corner): look up to 1.5 r.
      hi = 1.5 * r;
      if (!this.blocked(x + dx * hi, z + dz * hi, y_max)) return null;
    }
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (this.blocked(x + dx * mid, z + dz * mid, y_max)) hi = mid;
      else lo = mid;
    }
    const depth = r - lo;
    return depth > 0 ? [-dx * depth, -dz * depth] : null;
  }

  // --- Spawn ---

  // The spawn marker's triangle: the car starts at its middle, facing its
  // tip (the corner across its shortest side).
  static #spawn_of(object) {
    const v = object?.vertices;
    if (!v || v.length < 9) return null;
    const p = [0, 1, 2].map((i) => [v[i * 3], v[i * 3 + 2]]);
    const side = (i) => Math.hypot(p[(i + 1) % 3][0] - p[(i + 2) % 3][0], p[(i + 1) % 3][1] - p[(i + 2) % 3][1]);
    const tip = [0, 1, 2].reduce((best, i) => (side(i) < side(best) ? i : best), 0);
    const x = (p[0][0] + p[1][0] + p[2][0]) / 3, z = (p[0][1] + p[1][1] + p[2][1]) / 3;
    return { x, z, heading: Math.atan2(p[tip][0] - x, p[tip][1] - z) };
  }
}
