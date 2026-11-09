// Builds Marginal's world from OpenStreetMap data:
//   resources/world/marginal.usda  the meshes, in tiles (see TILE)
//   resources/world/map.json       what the game needs: spawn, drivable
//                                  roads, walls, the EN6 route
//   resources/images/palette.png, road.png
//
// Usage: node apps/marginal/tools/build_world.mjs [file.osm]
// (default: tools/osm/alges_cruz_quebrada.osm, see tools/fetch_osm.sh)
//
// Map data © OpenStreetMap contributors, ODbL (credited in the game).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { read_osm, projection, way_points, chain_ways, relation_rings } from "./osm.mjs";
import { Mesh, add_polygon, clean_ring, ring_area, write_usda, UP } from "./geometry.mjs";
import { write_textures, palette_uv, WALLS, ROAD_LANES, lane_u, LANE_WIDTH, ROAD_REPEAT } from "./textures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const OSM_FILE = process.argv[2] ?? join(HERE, "osm/alges_cruz_quebrada.osm");

// World origin (between Algés and Cruz Quebrada) and the area kept.
const ORIGIN = [38.699, -9.241];
const AREA = { x0: -1750, x1: 1750, z0: -900, z1: 1150 }; // z0 = north edge
const KEEP_DISTANCE = 300; // metres from the EN6: buildings and streets further away are dropped
const TILE = 200; // metres; each tile is one or two objects (culled together)

// Heights (y) of the flat layers, so overlapping surfaces don't fight.
const Y = { sea: -0.4, land: 0, water: 0.01, ballast: 0.02, street: 0.03, track: 0.04, en6: 0.06, pier: 0.5 };
const STREETS = {
  // highway=* -> width in metres
  primary: 7, primary_link: 5, secondary: 7, tertiary: 6.5, tertiary_link: 5,
  unclassified: 5.5, residential: 5.5, living_street: 4.5, service: 4,
};

const osm = read_osm(OSM_FILE);
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

const meshes = new Map();
const tile_mesh = (x, z, material) => {
  const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
  const name = `${material}_${tx < 0 ? "m" + -tx : tx}_${tz < 0 ? "m" + -tz : tz}`;
  if (!meshes.has(name)) meshes.set(name, new Mesh(name, material));
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

// A flat strip along a polyline, from `left` to `right` metres off the line
// (negative = right side), at height y, one palette color.
function ribbon(pts, left, right, y, color, mesh_for = (a) => tile_mesh(a[0], a[1], "palette")) {
  const ms = miters(pts);
  const uv = palette_uv(color);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const al = offset(a, ms[i], left), ar = offset(a, ms[i], right);
    const bl = offset(b, ms[i + 1], left), br = offset(b, ms[i + 1], right);
    const mesh = mesh_for([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    mesh.quad([al[0], y, al[1]], [ar[0], y, ar[1]], [br[0], y, br[1]], [bl[0], y, bl[1]], uv, UP);
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
const carriageways = chain_ways(en6_ways, true)
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
    const mesh = tile_mesh((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, "road");
    for (let k = 0; k < n; k++) {
      const variant = n === 1 ? ROAD_LANES.only : k === 0 ? ROAD_LANES.first : k === n - 1 ? ROAD_LANES.last : ROAD_LANES.middle;
      const [u0, u1] = lane_u(variant);
      const l = half - k * LANE_WIDTH, r = l - LANE_WIDTH;
      const al = offset(a, ms[i], l), ar = offset(a, ms[i], r), bl = offset(b, ms[i + 1], l), br = offset(b, ms[i + 1], r);
      const y = Y.en6;
      mesh.quad([al[0], y, al[1]], [ar[0], y, ar[1]], [br[0], y, br[1]], [bl[0], y, bl[1]],
        [[u0, va], [u1, va], [u1, vb], [u0, vb]], UP);
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
const add_walls = (ring, closed, skip_on_roads = false) => {
  for (let i = 0; i + (closed ? 0 : 1) < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (skip_on_roads) {
      // Water edges the roads cross (bridges): leave a gap for the road.
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (drivable.some(([x0, z0, x1, z1, h]) => seg_distance(mid, [x0, z0], [x1, z1]) < h + 3 ||
        seg_distance(a, [x0, z0], [x1, z1]) < h + 1 || seg_distance(b, [x0, z0], [x1, z1]) < h + 1)) continue;
    }
    walls.push([r2(a[0]), r2(a[1]), r2(b[0]), r2(b[1])]);
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

let building_count = 0, building_tris = 0;
function add_building(id, t, ring) {
  ring = clean_ring(ring);
  if (ring.length < 3 || Math.abs(ring_area(ring)) < 4) return;
  const c = centroid(ring);
  if (!in_area(c, -30) || !near_en6(c)) return;
  const h = building_height(id, t);
  const wall = palette_uv(WALLS[Math.floor(hash(id, 2) * WALLS.length)]);
  const roof = palette_uv(h > 14 || hash(id, 4) < 0.45 ? "roof_flat" : "roof_tile");
  const mesh = tile_mesh(c[0], c[1], "palette");
  const before = mesh.triangles;
  // Walls face away from the footprint's centre side (see outward below).
  const sign = ring_area(ring) > 0 ? 1 : -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const out = left_of(a, b).map((v) => v * sign);
    mesh.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]], wall, [out[0], 0, out[1]]);
  }
  add_polygon(mesh, ring, h, roof);
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
  const c = centroid(ring), mesh = tile_mesh(c[0], c[1], "palette");
  const sign = ring_area(ring) > 0 ? 1 : -1, uv = palette_uv("sidewalk");
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], out = left_of(a, b).map((v) => v * sign);
    mesh.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 0.9, b[1]], [a[0], 0.9, a[1]], uv, [out[0], 0, out[1]]);
  }
  add_polygon(mesh, ring, 0.9, uv);
  add_walls(ring, true);
}

// --- Land, sea, river ------------------------------------------------------------

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
const coast_lines = chain_ways(coast_ways, true).map((ids) => ids.map(node_xz).filter(Boolean));
const runs = coast_lines.flatMap(clip_runs);
const land = global_mesh("land", "palette");
for (const poly of land_polygons(runs)) add_polygon(land, clean_ring(poly, 0.2), Y.land, palette_uv("land"));
// Seawall: from the land down to the sea, facing the water (right of the coastline).
for (const run of runs) {
  for (let i = 0; i + 1 < run.length; i++) {
    const a = run[i], b = run[i + 1];
    const water = left_of(a, b).map((v) => -v);
    tile_mesh((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, "palette").quad(
      [a[0], Y.land, a[1]], [b[0], Y.land, b[1]], [b[0], Y.sea, b[1]], [a[0], Y.sea, a[1]],
      palette_uv("seawall"), [water[0], 0, water[1]]);
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
  add_polygon(tile_mesh(c[0], c[1], "palette"), ring, Y.water, palette_uv("river"));
  add_walls(ring, true, true);
};
for (const w of osm.ways.values())
  if (w.tags.natural === "water" && w.nodes[0] === w.nodes.at(-1)) add_water(way_points(osm, w, proj), w.id);
for (const r of osm.relations.values())
  if (r.tags.natural === "water" && r.tags.type === "multipolygon" && !r.tags.name?.includes("Tejo"))
    for (const ids of relation_rings(osm, r)) add_water(ids.map(node_xz).filter(Boolean), r.id);

// Piers and jetties.
for (const w of osm.ways.values()) {
  if (w.tags.man_made !== "pier" && w.tags.man_made !== "breakwater") continue;
  const pts = way_points(osm, w, proj).filter((p) => in_area(p));
  if (pts.length < 2) continue;
  const color = w.tags.man_made === "breakwater" ? "seawall" : "pier";
  if (w.nodes[0] === w.nodes.at(-1)) {
    const ring = clean_ring(pts);
    if (ring.length >= 3) add_polygon(tile_mesh(...centroid(ring), "palette"), ring, Y.pier, palette_uv(color));
  } else ribbon(pts, 1.5, -1.5, Y.pier, color);
}

// The edge of the world.
add_walls([[AREA.x0, AREA.z0], [AREA.x1, AREA.z0], [AREA.x1, AREA.z1], [AREA.x0, AREA.z1]], true);

// --- Output ---------------------------------------------------------------------

// Spawn: on the westbound carriageway (Algés -> Cruz Quebrada), near its start.
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
  "Avenida Marginal (EN6), Alges - Cruz Quebrada. Generated by apps/marginal/tools/build_world.mjs from OpenStreetMap data (c) OpenStreetMap contributors, ODbL.");
writeFileSync(join(APP, "resources/world/marginal.usda"), usda);

const map = {
  attribution: "© OpenStreetMap contributors",
  origin: ORIGIN,
  area: AREA,
  spawn,
  en6: carriageways.map((c) => c.pts.map(([x, z]) => [r2(x), r2(z)])),
  roads: drivable,
  walls,
};
writeFileSync(join(APP, "resources/world/map.json"), JSON.stringify(map));

const tris = mesh_list.reduce((s, m) => s + m.triangles, 0);
console.log(`carriageways: ${carriageways.map((c) => c.pts.length + " pts").join(", ")}`);
console.log(`streets: ${street_count}, buildings: ${building_count} (${building_tris} tris)`);
console.log(`coast runs: ${runs.length}, walls: ${walls.length}, drivable segments: ${drivable.length}`);
console.log(`meshes: ${mesh_list.length}, triangles: ${tris}, usda: ${(usda.length / 1e6).toFixed(2)} MB`);
console.log(`spawn: ${JSON.stringify(spawn)}`);
