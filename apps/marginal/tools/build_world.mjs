// Builds Marginal's world from OpenStreetMap data:
//   resources/world/marginal.usda  the meshes, in tiles (see TILE)
//   resources/world/map.json       what the game needs: spawn, drivable
//                                  roads, walls, the EN6 route, the ground's
//                                  height grid
//   resources/images/palette.png, road.png
//
// Usage: node apps/marginal/tools/build_world.mjs [file.osm ...]
// (default: every .osm file in tools/osm/, see tools/fetch_osm.sh)
// The relief comes from tools/dem/N38W010.hgt.gz (see tools/fetch_dem.sh).
//
// Map data © OpenStreetMap contributors, ODbL (credited in the game).
// Elevation: NASA SRTM (public domain).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { read_osm_files, projection, way_points, chain_ways, chain_roads, relation_rings } from "./osm.mjs";
import { Mesh, add_polygon, clean_ring, ring_area, triangulate, write_usda, UP } from "./geometry.mjs";
import { read_hgt, build_terrain } from "./terrain.mjs";
import { write_textures, palette_uv, WALLS, ROAD_LANES, lane_u, LANE_WIDTH, ROAD_REPEAT } from "./textures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const OSM_DIR = join(HERE, "osm");
const OSM_FILES = process.argv.length > 2 ? process.argv.slice(2)
  : existsSync(OSM_DIR) ? readdirSync(OSM_DIR).filter((f) => f.endsWith(".osm")).sort().map((f) => join(OSM_DIR, f)) : [];
if (!OSM_FILES.length) {
  console.error(`no .osm files in ${OSM_DIR}: run apps/marginal/tools/fetch_osm.sh`);
  process.exit(1);
}
const DEM_FILE = join(HERE, "dem/N38W010.hgt.gz"); // SRTM tile, south-west corner 38 N, 10 W
if (!existsSync(DEM_FILE)) {
  console.error(`${DEM_FILE} is missing: run apps/marginal/tools/fetch_dem.sh`);
  process.exit(1);
}

// World origin (between Algés and Cruz Quebrada) and the area kept: Algés
// to the west end of Paço de Arcos.
const ORIGIN = [38.699, -9.241];
const AREA = { x0: -5200, x1: 1750, z0: -900, z1: 1400 }; // z0 = north edge
const KEEP_DISTANCE = 300; // metres from the EN6: buildings and streets further away are dropped
const TILE = 200; // metres; each tile is up to three objects (culled together)

// The relief (see terrain.mjs).
const CELL = 40; // metres: the ground's grid. A whole number of cells per tile.
const FLOOR = 2; // metres: the lowest ground, and the land's height at the sea
// Height of the layers laid on the ground, above it, so overlapping surfaces
// don't fight. `sea` and `pier` are heights above sea level.
const Y = { sea: -0.4, water: 0.01, ballast: 0.02, street: 0.03, track: 0.04, en6: 0.06, pier: FLOOR + 0.1 };
const STREETS = {
  // highway=* -> width in metres
  primary: 7, primary_link: 5, secondary: 7, tertiary: 6.5, tertiary_link: 5,
  unclassified: 5.5, residential: 5.5, living_street: 4.5, service: 4,
};

const osm = read_osm_files(OSM_FILES);
const proj = projection(...ORIGIN);
const node_xz = (id) => {
  const n = osm.nodes.get(id);
  return n ? proj.to_world(n.lat, n.lon) : null;
};
const in_area = ([x, z], margin = 0) =>
  x >= AREA.x0 - margin && x <= AREA.x1 + margin && z >= AREA.z0 - margin && z <= AREA.z1 + margin;
const r2 = (v) => Math.round(v * 100) / 100;

// Deterministic per-feature randomness (OSM ids), so rebuilding gives the same world.
const hash = (id, salt = 0) => {
  let h = (Number(BigInt(id) % 2147483647n) ^ (salt * 0x9e3779b9)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

// --- Meshes, by tile ------------------------------------------------------

// A tile has one mesh per kind, named <kind>_<tile x>_<tile z>:
//   ground  what lies on the ground: land, water, streets, railway
//   road    the EN6's lanes (the road texture)
//   solid   what stands on it: buildings, platforms, the seawall, piers.
//           The game makes only these cast shadows.
const KINDS = { ground: "palette", road: "road", solid: "palette" };
const meshes = new Map();
const tile_mesh = (x, z, kind) => {
  const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
  const name = `${kind}_${tx < 0 ? "m" + -tx : tx}_${tz < 0 ? "m" + -tz : tz}`;
  if (!meshes.has(name)) meshes.set(name, new Mesh(name, KINDS[kind]));
  return meshes.get(name);
};
const global_mesh = (name, material) => {
  if (!meshes.has(name)) meshes.set(name, new Mesh(name, material));
  return meshes.get(name);
};
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// --- Lines: offsets and ribbons ---------------------------------------------

// Left-hand unit normal of segment a->b (x east, z south: left of travel).
const left_of = (a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  return [dz / len, -dx / len];
};
// Per-point miter normals (left side), limited so sharp corners don't spike.
function miters(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const n0 = i > 0 ? left_of(pts[i - 1], pts[i]) : null;
    const n1 = i < pts.length - 1 ? left_of(pts[i], pts[i + 1]) : null;
    if (!n0 || !n1) {
      out.push(n0 ?? n1);
      continue;
    }
    let mx = n0[0] + n1[0], mz = n0[1] + n1[1];
    const len = Math.hypot(mx, mz);
    if (len < 1e-3) {
      out.push(n1);
      continue;
    }
    mx /= len, mz /= len;
    const scale = Math.min(2, 1 / Math.max(0.5, mx * n1[0] + mz * n1[1]));
    out.push([mx * scale, mz * scale]);
  }
  return out;
}
const offset = (p, n, d) => [p[0] + n[0] * d, p[1] + n[1] * d];

// A strip along a polyline, from `left` to `right` metres off the line
// (negative = right side), laid on the ground `lift` above it, one palette color.
function ribbon(pts, left, right, lift, color) {
  const ms = miters(pts);
  const uv = palette_uv(color);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const al = offset(a, ms[i], left), ar = offset(a, ms[i], right);
    const bl = offset(b, ms[i + 1], left), br = offset(b, ms[i + 1], right);
    lay_quad([...al, ...uv], [...ar, ...uv], [...br, ...uv], [...bl, ...uv], lift, "ground");
  }
}

// Distance from p to segment a-b.
function seg_distance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}

// --- EN6 ------------------------------------------------------------------

const en6_ways = [...osm.ways.values()].filter((w) => w.tags.highway && /^EN ?6$/.test(w.tags.ref ?? ""));
const seg_lanes = new Map(); // "a>b" node ids -> lanes
for (const w of en6_ways) {
  const lanes = Math.max(1, parseInt(w.tags.lanes ?? "2", 10) || 2);
  for (let i = 0; i + 1 < w.nodes.length; i++) seg_lanes.set(`${w.nodes[i]}>${w.nodes[i + 1]}`, lanes);
}
// Each carriageway as a directed chain (they're one-way), clipped to the area.
const carriageways = chain_roads(en6_ways, node_xz)
  .map((ids) => {
    const pts = [], lanes = [];
    for (let i = 0; i < ids.length; i++) {
      const p = node_xz(ids[i]);
      if (!p || !in_area(p, -40)) continue;
      if (pts.length && Math.hypot(p[0] - pts.at(-1)[0], p[1] - pts.at(-1)[1]) < 0.5) continue;
      pts.push(p);
      lanes.push(seg_lanes.get(`${ids[i]}>${ids[i + 1]}`) ?? lanes.at(-1) ?? 2);
    }
    return { pts, lanes };
  })
  .filter((c) => c.pts.length > 1);

const en6_segments = [];
for (const c of carriageways)
  for (let i = 0; i + 1 < c.pts.length; i++) en6_segments.push([c.pts[i], c.pts[i + 1], (c.lanes[i] * LANE_WIDTH) / 2]);
const near_en6 = (p, d = KEEP_DISTANCE) => en6_segments.some(([a, b]) => seg_distance(p, a, b) < d);

// --- The coast ------------------------------------------------------------------

// The coastline (land on its left, OSM convention) clipped to AREA, closed
// along the area's edges, gives the land polygons.
function clip_runs(pts) {
  const runs = [];
  let run = null;
  const inside = (p) => in_area(p);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    // Liang-Barsky
    let t0 = 0, t1 = 1;
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const edges = [[-dx, p[0] - AREA.x0], [dx, AREA.x1 - p[0]], [-dz, p[1] - AREA.z0], [dz, AREA.z1 - p[1]]];
    let visible = true;
    for (const [pe, qe] of edges) {
      if (pe === 0) {
        if (qe < 0) visible = false;
      } else {
        const t = qe / pe;
        if (pe < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!visible || t0 > t1) continue;
    const at = (t) => [p[0] + dx * t, p[1] + dz * t];
    if (!inside(p)) run = [at(t0)];
    else if (!run) run = [p]; // the coastline starts inside: can't close it
    if (inside(q)) run.push(q);
    else {
      run.push(at(t1));
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}
// Position along the area's edge, counter-clockwise on the map (north up):
// south edge west->east, east edge south->north, north edge, west edge.
function perimeter_t([x, z]) {
  const W = AREA.x1 - AREA.x0, H = AREA.z1 - AREA.z0, e = 0.01;
  if (Math.abs(z - AREA.z1) < e) return x - AREA.x0;
  if (Math.abs(x - AREA.x1) < e) return W + (AREA.z1 - z);
  if (Math.abs(z - AREA.z0) < e) return W + H + (AREA.x1 - x);
  return 2 * W + H + (z - AREA.z0);
}
const CORNERS = [
  [W => W, [AREA.x1, AREA.z1]], // SE
  [(W, H) => W + H, [AREA.x1, AREA.z0]], // NE
  [(W, H) => 2 * W + H, [AREA.x0, AREA.z0]], // NW
  [(W, H) => 2 * W + 2 * H, [AREA.x0, AREA.z1]], // SW
];
function land_polygons(runs) {
  const W = AREA.x1 - AREA.x0, H = AREA.z1 - AREA.z0, P = 2 * W + 2 * H;
  const open = runs.map((r) => ({ run: r, t_in: perimeter_t(r[0]), t_out: perimeter_t(r.at(-1)), used: false }));
  const polys = [];
  for (const start of open) {
    if (start.used) continue;
    const ring = [];
    let cur = start;
    while (!cur.used) {
      cur.used = true;
      ring.push(...cur.run);
      // Walk the edge counter-clockwise to the next run's entry.
      const t = cur.t_out;
      const next = open.reduce((best, o) => {
        const d = (o.t_in - t + P) % P, bd = best ? (best.t_in - t + P) % P : Infinity;
        return d < bd ? o : best;
      }, null);
      // A run that leaves and comes back at the same place goes all the way round.
      const d_next = (next.t_in - t + P) % P || P;
      const corners = CORNERS.map(([tc, corner]) => [(((tc(W, H) - t) % P) + P) % P, corner])
        .filter(([d]) => d > 0 && d < d_next)
        .sort((a, b) => a[0] - b[0]);
      for (const [, corner] of corners) ring.push(corner);
      cur = next;
    }
    polys.push(ring);
  }
  return polys;
}

const coast_ways = [...osm.ways.values()].filter((w) => w.tags.natural === "coastline");
const coast_chains = chain_ways(coast_ways, true).map((ids) => ({ closed: ids[0] === ids.at(-1), pts: ids.map(node_xz).filter(Boolean) }));
// Closed coastlines inside the area are islands: land rings of their own.
const islands = coast_chains.filter((c) => c.closed && c.pts.every((p) => in_area(p))).map((c) => c.pts.slice(0, -1));
const runs = coast_chains.filter((c) => !(c.closed && c.pts.every((p) => in_area(p)))).flatMap((c) => clip_runs(c.pts));
// The land, as rings of [x, z].
const land_rings = [...land_polygons(runs), ...islands].map((poly) => clean_ring(poly, 0.2)).filter((ring) => ring.length >= 3);

// --- The ground --------------------------------------------------------------------

const point_in_ring = (x, z, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
// The grid covers whole tiles, so a tile's edges are grid lines. Around the
// EN6 the ground is levelled (the road doesn't tilt sideways on the slopes).
const snap = (v, round) => round(v / TILE) * TILE;
const terrain = build_terrain(read_hgt(DEM_FILE, 38, -10), proj,
  { x0: snap(AREA.x0, Math.floor), z0: snap(AREA.z0, Math.floor), x1: snap(AREA.x1, Math.ceil), z1: snap(AREA.z1, Math.ceil) }, CELL, {
    floor: FLOOR,
    roads: carriageways,
    // Past the area's edge: as at the edge.
    is_land: (x, z) => {
      const cx = Math.min(AREA.x1 - 1, Math.max(AREA.x0 + 1, x)), cz = Math.min(AREA.z1 - 1, Math.max(AREA.z0 + 1, z));
      return land_rings.some((ring) => point_in_ring(cx, cz, ring));
    },
  });

// Laying things on the ground: lay(kind) takes the pieces Terrain.drape cuts
// (convex, each on one ground triangle) into the tiles' meshes.
let laid = 0;
const lay = (kind) => (points, normal) => {
  const mesh = tile_mesh(...centroid(points.map((p) => [p[0], p[2]])), kind);
  for (let k = 1; k + 1 < points.length; k++) {
    const [a, b, c] = [points[0], points[k], points[k + 1]];
    mesh.tri(a.slice(0, 3), b.slice(0, 3), c.slice(0, 3), [a.slice(3), b.slice(3), c.slice(3)], normal, normal);
    laid++;
  }
};
// A quad of [x, z, u, v] points (in order around it), `lift` above the ground.
function lay_quad(a, b, c, d, lift, kind) {
  // Whole when it is convex (the usual case): fewer pieces than two triangles.
  const quad = [a, b, c, d];
  const turns = quad.map((p, i) => {
    const q = quad[(i + 1) % 4], r = quad[(i + 2) % 4];
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  });
  if (turns.every((t) => t >= 0) || turns.every((t) => t <= 0)) return terrain.drape(quad, lift, lay(kind));
  terrain.drape([a, b, c], lift, lay(kind));
  terrain.drape([a, c, d], lift, lay(kind));
}
// Lowest and highest ground under a ring's points.
function ground_range(ring) {
  let low = 1e30, high = -1e30;
  for (const [x, z] of ring) {
    const y = terrain.height(x, z);
    low = Math.min(low, y), high = Math.max(high, y);
  }
  return [low, high];
}
// A block: walls around a ring of [x, z] from y = base up to y = top, and a flat top.
function add_block(mesh, ring, base, top, wall_uv, top_uv) {
  const sign = ring_area(ring) > 0 ? 1 : -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const out = left_of(a, b).map((v) => v * sign);
    mesh.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], wall_uv, [out[0], 0, out[1]]);
  }
  add_polygon(mesh, ring, top, top_uv);
}

// The drivable surface for the game: [x0, z0, x1, z1, half width].
const drivable = [];

// Lanes, textured. The OSM line is the middle of the carriageway; lanes go
// left (median side) to right (kerb side).
for (const c of carriageways) {
  const ms = miters(c.pts);
  let dist = 0;
  for (let i = 0; i + 1 < c.pts.length; i++) {
    const a = c.pts[i], b = c.pts[i + 1];
    const n = c.lanes[i], half = (n * LANE_WIDTH) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const va = dist / ROAD_REPEAT, vb = (dist + len) / ROAD_REPEAT;
    dist += len;
    for (let k = 0; k < n; k++) {
      const variant = n === 1 ? ROAD_LANES.only : k === 0 ? ROAD_LANES.first : k === n - 1 ? ROAD_LANES.last : ROAD_LANES.middle;
      const [u0, u1] = lane_u(variant);
      const l = half - k * LANE_WIDTH, r = l - LANE_WIDTH;
      const al = offset(a, ms[i], l), ar = offset(a, ms[i], r), bl = offset(b, ms[i + 1], l), br = offset(b, ms[i + 1], r);
      lay_quad([...al, u0, va], [...ar, u1, va], [...br, u1, vb], [...bl, u0, vb], Y.en6, "road");
    }
    // Kerb-side shoulder and a pavement strip.
    ribbon([a, b], -half, -half - 0.6, Y.street, "street");
    drivable.push([r2(a[0]), r2(a[1]), r2(b[0]), r2(b[1]), r2(half + 0.6)]);
  }
}

// --- Streets ----------------------------------------------------------------

let street_count = 0;
for (const w of osm.ways.values()) {
  const t = w.tags;
  const width = STREETS[t.highway];
  if (!width || /^EN ?6$/.test(t.ref ?? "")) continue;
  if (t.bridge || t.tunnel || (t.layer && t.layer !== "0") || t.area === "yes") continue;
  if (t.access === "private" || t.service === "driveway") continue;
  const pts = way_points(osm, w, proj).filter((p) => in_area(p, -20));
  if (pts.length < 2 || !pts.some((p) => near_en6(p))) continue;
  ribbon(pts, width / 2, -width / 2, Y.street, "street");
  for (let i = 0; i + 1 < pts.length; i++)
    drivable.push([r2(pts[i][0]), r2(pts[i][1]), r2(pts[i + 1][0]), r2(pts[i + 1][1]), width / 2]);
  street_count++;
}

// --- Railway (Linha de Cascais) ----------------------------------------------

for (const w of osm.ways.values()) {
  const t = w.tags;
  if (t.railway !== "rail" || t.tunnel) continue;
  const pts = way_points(osm, w, proj).filter((p) => in_area(p, -20));
  if (pts.length < 2) continue;
  ribbon(pts, 1.7, -1.7, Y.ballast, "ballast");
  ribbon(pts, 0.8, -0.8, Y.track, "rail");
}

// --- Walls (collision) ---------------------------------------------------------

const walls = []; // [x0, z0, x1, z1]
// Water edges the roads cross (bridges) get a gap for the road: the edge is
// checked in pieces of up to 3 m, and the pieces off the roads are kept.
const on_drivable = (a, b) => {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return drivable.some(([x0, z0, x1, z1, h]) => seg_distance(mid, [x0, z0], [x1, z1]) < h + 3 ||
    seg_distance(a, [x0, z0], [x1, z1]) < h + 1 || seg_distance(b, [x0, z0], [x1, z1]) < h + 1);
};
const add_walls = (ring, closed, skip_on_roads = false) => {
  const push = (a, b) => walls.push([r2(a[0]), r2(a[1]), r2(b[0]), r2(b[1])]);
  for (let i = 0; i + (closed ? 0 : 1) < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (!skip_on_roads) {
      push(a, b);
      continue;
    }
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    const at = (k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
    let start = null; // first piece of the run being kept
    for (let k = 0; k < n; k++) {
      const off = !on_drivable(at(k), at(k + 1));
      if (off && start === null) start = k;
      if (!off && start !== null) push(at(start), at(k)), (start = null);
    }
    if (start !== null) push(at(start), b);
  }
};

// --- Buildings ----------------------------------------------------------------

function building_height(id, t) {
  const h = parseFloat(t.height ?? t["building:height"]);
  if (h > 0) return Math.min(h, 120);
  const levels = parseFloat(t["building:levels"]);
  if (levels > 0) return levels * 3.1 + 1;
  if (["garage", "garages", "shed", "kiosk", "hut", "roof", "carport"].includes(t.building)) return 3;
  if (["industrial", "warehouse", "retail", "commercial", "sports_hall", "train_station"].includes(t.building)) return 8 + hash(id, 3) * 4;
  return (2 + Math.floor(hash(id, 1) * 4)) * 3.1 + 1; // 2-5 storeys
}

// Distance between segments a-b and c-d (0 when they cross).
function segments_distance(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return 0;
  return Math.min(seg_distance(a, c, d), seg_distance(b, c, d), seg_distance(c, a, b), seg_distance(d, a, b));
}
// How far a ring reaches into the EN6's lanes and shoulder (> 0: it does),
// and the unit direction that takes it out (away from that stretch of road).
function en6_intrusion(ring) {
  let worst = { depth: 0, dir: null };
  const c = centroid(ring);
  for (const [a, b, half] of en6_segments) {
    if (seg_distance(c, a, b) > 150) continue;
    let d = 1e30;
    for (let i = 0; i < ring.length; i++) d = Math.min(d, segments_distance(ring[i], ring[(i + 1) % ring.length], a, b));
    if (point_in_ring(a[0], a[1], ring)) d = 0;
    const depth = half + 0.6 + 0.3 - d; // lanes, shoulder, a little room
    if (depth <= worst.depth) continue;
    const n = left_of(a, b), side = (c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1] >= 0 ? 1 : -1;
    worst = { depth, dir: [n[0] * side, n[1] * side] };
  }
  return worst;
}

let building_count = 0, building_tris = 0, buildings_moved = 0, buildings_dropped = 0;
function add_building(id, t, ring) {
  ring = clean_ring(ring);
  if (ring.length < 3 || Math.abs(ring_area(ring)) < 4) return;
  // OSM footprints are sometimes a metre or two off and reach into the EN6:
  // move those out of the road; drop the ones that stand on it.
  for (let pass = 0; pass < 3; pass++) {
    const { depth, dir } = en6_intrusion(ring);
    if (depth <= 0) break;
    if (depth > 4 || pass === 2) return void buildings_dropped++;
    ring = ring.map(([x, z]) => [x + dir[0] * (depth + 0.05), z + dir[1] * (depth + 0.05)]);
    if (pass === 0) buildings_moved++;
  }
  const c = centroid(ring);
  if (!in_area(c, -30) || !near_en6(c)) return;
  const h = building_height(id, t);
  const wall = palette_uv(WALLS[Math.floor(hash(id, 2) * WALLS.length)]);
  const roof = palette_uv(h > 14 || hash(id, 4) < 0.45 ? "roof_flat" : "roof_tile");
  const mesh = tile_mesh(c[0], c[1], "solid");
  const before = mesh.triangles;
  // On a slope: its height above the highest ground, its walls down into the lowest.
  const [low, high] = ground_range(ring);
  add_block(mesh, ring, low - 0.3, high + h, wall, roof);
  building_tris += mesh.triangles - before;
  add_walls(ring, true);
  building_count++;
}
for (const w of osm.ways.values()) {
  const t = w.tags;
  if (!t.building || t.building === "no" || t.location === "underground" || (t.layer && +t.layer < 0)) continue;
  if (w.nodes[0] !== w.nodes.at(-1)) continue;
  add_building(w.id, t, way_points(osm, w, proj));
}
for (const r of osm.relations.values()) {
  if (r.tags.type !== "multipolygon" || !r.tags.building) continue;
  for (const ids of relation_rings(osm, r)) add_building(r.id, r.tags, ids.map(node_xz).filter(Boolean));
}

// Station platforms: low blocks.
for (const w of osm.ways.values()) {
  if (w.tags.railway !== "platform" || w.nodes[0] !== w.nodes.at(-1)) continue;
  const ring = clean_ring(way_points(osm, w, proj));
  if (ring.length < 3 || !in_area(ring[0])) continue;
  const [low, high] = ground_range(ring), uv = palette_uv("sidewalk");
  add_block(tile_mesh(...centroid(ring), "solid"), ring, low - 0.3, high + 0.9, uv, uv);
  add_walls(ring, true);
}

// --- Land, sea, river ------------------------------------------------------------

for (const ring of land_rings) terrain.drape_polygon(ring, triangulate(ring), palette_uv("land"), 0, lay("ground"));
// Seawall: from the land down to the sea, facing the water (right of the
// coastline). Cut where the ground changes slope, to follow its edge.
for (const run of [...runs, ...islands.map((ring) => [...ring, ring[0]])]) {
  for (let i = 0; i + 1 < run.length; i++) {
    const water = left_of(run[i], run[i + 1]).map((v) => -v);
    const pts = terrain.split(run[i], run[i + 1]);
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      tile_mesh((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, "solid").quad(
        [a[0], terrain.height(a[0], a[1]), a[1]], [b[0], terrain.height(b[0], b[1]), b[1]], [b[0], Y.sea, b[1]], [a[0], Y.sea, a[1]],
        palette_uv("seawall"), [water[0], 0, water[1]]);
    }
  }
  add_walls(run, false, true);
}

// The sea: one big plane under everything (fog hides its edges).
const sea = global_mesh("sea", "palette");
const S = 6000;
sea.quad([-S, Y.sea, -S], [S, Y.sea, -S], [S, Y.sea, S], [-S, Y.sea, S], palette_uv("sea"), UP);

// Rivers and ponds (natural=water) over the land.
const add_water = (ring, id) => {
  ring = clean_ring(ring.filter((p) => in_area(p, 200)));
  if (ring.length < 3) return;
  const c = centroid(ring);
  if (!near_en6(c, KEEP_DISTANCE + 300)) return;
  terrain.drape_polygon(ring, triangulate(ring), palette_uv("river"), Y.water, lay("ground"));
  add_walls(ring, true, true);
};
for (const w of osm.ways.values())
  if (w.tags.natural === "water" && w.nodes[0] === w.nodes.at(-1)) add_water(way_points(osm, w, proj), w.id);
for (const r of osm.relations.values())
  if (r.tags.natural === "water" && r.tags.type === "multipolygon" && !r.tags.name?.includes("Tejo"))
    for (const ids of relation_rings(osm, r)) add_water(ids.map(node_xz).filter(Boolean), r.id);

// Piers and jetties: blocks standing in the sea, level with the lowest land.
for (const w of osm.ways.values()) {
  if (w.tags.man_made !== "pier" && w.tags.man_made !== "breakwater") continue;
  const pts = way_points(osm, w, proj).filter((p) => in_area(p));
  if (pts.length < 2) continue;
  const uv = palette_uv(w.tags.man_made === "breakwater" ? "seawall" : "pier");
  let ring = pts;
  if (w.nodes[0] !== w.nodes.at(-1)) {
    // A line: 3 m wide, out along its left side and back along its right.
    const ms = miters(pts);
    ring = [...pts.map((p, i) => offset(p, ms[i], 1.5)), ...pts.map((p, i) => offset(p, ms[i], -1.5)).reverse()];
  }
  ring = clean_ring(ring);
  if (ring.length >= 3) add_block(tile_mesh(...centroid(ring), "solid"), ring, Y.sea, Y.pier, uv, uv);
}

// The edge of the world.
add_walls([[AREA.x0, AREA.z0], [AREA.x1, AREA.z0], [AREA.x1, AREA.z1], [AREA.x0, AREA.z1]], true);

// --- Output ---------------------------------------------------------------------

// Spawn: on the westbound carriageway (Algés -> Paço de Arcos), near its start.
const westbound = carriageways.reduce((best, c) => (c.pts[0][0] > (best?.pts[0][0] ?? -1e9) ? c : best), null);
let spawn = null;
{
  let d = 0;
  for (let i = 0; i + 1 < westbound.pts.length && !spawn; i++) {
    const a = westbound.pts[i], b = westbound.pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d + len >= 120) {
      const t = (120 - d) / len, half = (westbound.lanes[i] * LANE_WIDTH) / 2;
      const n = left_of(a, b); // spawn in the right-hand lane
      spawn = {
        x: r2(a[0] + (b[0] - a[0]) * t - n[0] * (half - LANE_WIDTH / 2)),
        z: r2(a[1] + (b[1] - a[1]) * t - n[1] * (half - LANE_WIDTH / 2)),
        heading: +Math.atan2(b[0] - a[0], b[1] - a[1]).toFixed(4),
      };
    }
    d += len;
  }
}

mkdirSync(join(APP, "resources/world"), { recursive: true });
mkdirSync(join(APP, "resources/images"), { recursive: true });
write_textures(join(APP, "resources/images"));

const mesh_list = [...meshes.values()].filter((m) => m.triangles).sort((a, b) => a.name.localeCompare(b.name));
const usda = write_usda(mesh_list, { palette: "../images/palette.png", road: "../images/road.png" },
  "Avenida Marginal (EN6), Alges - Paco de Arcos. Generated by apps/marginal/tools/build_world.mjs from OpenStreetMap data (c) OpenStreetMap contributors, ODbL, and NASA SRTM elevation data.");
writeFileSync(join(APP, "resources/world/marginal.usda"), usda);

const map = {
  attribution: "© OpenStreetMap contributors",
  origin: ORIGIN,
  area: AREA,
  spawn,
  en6: carriageways.map((c) => c.pts.map(([x, z]) => [r2(x), r2(z)])),
  roads: drivable,
  walls,
  // The ground: (nx + 1) * (nz + 1) node heights in centimetres, row by row
  // (north to south). See tools/terrain.mjs for how a cell is interpolated.
  terrain: {
    x0: terrain.x0, z0: terrain.z0, cell: terrain.cell, nx: terrain.nx, nz: terrain.nz,
    heights: Array.from(terrain.heights, (h) => Math.round(h * 100)),
  },
};
writeFileSync(join(APP, "resources/world/map.json"), JSON.stringify(map));

const tris = mesh_list.reduce((s, m) => s + m.triangles, 0);
console.log(`carriageways: ${carriageways.map((c) => c.pts.length + " pts").join(", ")}`);
console.log(`streets: ${street_count}, buildings: ${building_count} (${building_tris} tris; ${buildings_moved} moved off the EN6, ${buildings_dropped} dropped)`);
console.log(`coast runs: ${runs.length}, islands: ${islands.length}, walls: ${walls.length}, drivable segments: ${drivable.length}`);
const heights = Array.from(terrain.heights);
console.log(`ground: ${terrain.nx} x ${terrain.nz} cells of ${CELL} m, ${Math.min(...heights)} to ${Math.max(...heights)} m, ${laid} triangles laid on it`);
const kinds = Object.keys(KINDS).map((k) => `${mesh_list.filter((m) => m.name.startsWith(k + "_")).length} ${k}`);
console.log(`meshes: ${mesh_list.length} (${kinds.join(", ")}), triangles: ${tris}, usda: ${(usda.length / 1e6).toFixed(2)} MB`);
console.log(`spawn: ${JSON.stringify(spawn)}`);
