// The game's view of the world (resources/world/map.json, made by
// tools/build_world.mjs): walls to collide with and the drivable roads,
// looked up through a uniform grid so a query only checks nearby segments,
// and the ground's height. Walls and roads are 2D, seen from above: [x, z].
const CELL = 16; // metres

class SegmentGrid {
  #cells = new Map();
  constructor(segments, pad = (s) => 0) {
    this.segments = segments;
    segments.forEach((s, i) => {
      const p = pad(s);
      const x0 = Math.floor((Math.min(s[0], s[2]) - p) / CELL), x1 = Math.floor((Math.max(s[0], s[2]) + p) / CELL);
      const z0 = Math.floor((Math.min(s[1], s[3]) - p) / CELL), z1 = Math.floor((Math.max(s[1], s[3]) + p) / CELL);
      for (let cx = x0; cx <= x1; cx++)
        for (let cz = z0; cz <= z1; cz++) {
          const key = cx * 65536 + cz;
          let cell = this.#cells.get(key);
          if (!cell) this.#cells.set(key, (cell = []));
          cell.push(i);
        }
    });
  }
  // Indices of the segments in the cells a circle (x, z, r) touches; may repeat.
  *near(x, z, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.#cells.get(cx * 65536 + cz);
        if (cell) yield* cell;
      }
  }
}

// Closest point of segment (ax, az)-(bx, bz) to (x, z): [px, pz].
const closest = (x, z, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return [ax + dx * t, az + dz * t];
};

export default class WorldMap {
  #walls;
  #roads;
  #terrain; // { x0, z0, cell, nx, nz }
  #heights; // metres, (nx + 1) * (nz + 1), row by row (z)
  constructor(map) {
    this.data = map;
    this.spawn = map.spawn;
    this.attribution = map.attribution;
    this.#walls = new SegmentGrid(map.walls);
    this.#roads = new SegmentGrid(map.roads, (s) => s[4]);
    this.#terrain = map.terrain;
    this.#heights = Float32Array.from(map.terrain.heights, (cm) => cm / 100);
  }

  // Height of the ground at (x, z). The grid's cells are split in two
  // triangles by the diagonal from their (x0, z0) corner, and the height is
  // linear in each: exactly the ground's mesh (see tools/terrain.mjs).
  height(x, z) {
    const { x0, z0, cell, nx, nz } = this.#terrain, h = this.#heights;
    const gx = (x - x0) / cell, gz = (z - z0) / cell;
    const i = Math.min(nx - 1, Math.max(0, Math.floor(gx))), j = Math.min(nz - 1, Math.max(0, Math.floor(gz)));
    const fx = Math.min(1, Math.max(0, gx - i)), fz = Math.min(1, Math.max(0, gz - j));
    const n = j * (nx + 1) + i;
    const h00 = h[n], h11 = h[n + nx + 2];
    if (fx >= fz) return h00 + (h[n + 1] - h00) * fx + (h11 - h[n + 1]) * fz;
    return h00 + (h11 - h[n + nx + 1]) * fx + (h[n + nx + 1] - h00) * fz;
  }

  // Whether (x, z) is on a road (asphalt) rather than off-road.
  on_road(x, z) {
    for (const i of this.#roads.near(x, z, 0)) {
      const [ax, az, bx, bz, half] = this.#roads.segments[i];
      const [px, pz] = closest(x, z, ax, az, bx, bz);
      if ((x - px) ** 2 + (z - pz) ** 2 <= half * half) return true;
    }
    return false;
  }

  // Pushes a circle out of the walls. Returns the push { x, z, nx, nz } (nx,
  // nz: the unit direction it was pushed in), or null if it touched nothing.
  collide(x, z, r) {
    let px = 0, pz = 0, hit = false;
    // A few passes: being pushed out of one wall can push into another.
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      const seen = new Set(); // a segment can be in several cells
      for (const i of this.#walls.near(x + px, z + pz, r)) {
        if (seen.has(i)) continue;
        seen.add(i);
        const [ax, az, bx, bz] = this.#walls.segments[i];
        const cx = x + px, cz = z + pz;
        const [qx, qz] = closest(cx, cz, ax, az, bx, bz);
        const dx = cx - qx, dz = cz - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2), nx, nz;
        if (d > 1e-6) (nx = dx / d), (nz = dz / d);
        else {
          // Centre right on the wall: push along the wall's normal.
          const len = Math.hypot(bx - ax, bz - az) || 1;
          (nx = -(bz - az) / len), (nz = (bx - ax) / len), (d = 0);
        }
        px += nx * (r - d);
        pz += nz * (r - d);
        hit = moved = true;
      }
      if (!moved) break;
    }
    if (!hit) return null;
    const len = Math.hypot(px, pz) || 1;
    return { x: px, z: pz, nx: px / len, nz: pz / len };
  }
}
