// Minimal OpenStreetMap XML reader (the .osm files the OSM API / JOSM give)
// and the projection from lat/lon to game world coordinates.
//
// World: 1 unit = 1 metre, right-handed, y up: x = east, z = south
// (north is -z), y = 0 is sea level.
import { readFileSync } from "node:fs";

const EARTH_RADIUS = 6371000;
const attrs = (text) => {
  const out = {};
  for (const m of text.matchAll(/(\w[\w:]*)="([^"]*)"/g)) out[m[1]] = unescape_xml(m[2]);
  return out;
};
const unescape_xml = (s) =>
  s.replace(/&(lt|gt|quot|apos|amp);/g, (_, e) => ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[e]);

// { nodes: Map id -> { lat, lon, tags }, ways: Map id -> { id, nodes: [ids], tags },
//   relations: Map id -> { id, members: [{ type, ref, role }], tags } }
export function read_osm(path) {
  const xml = readFileSync(path, "utf8");
  const nodes = new Map(), ways = new Map(), relations = new Map();
  // Elements are either self-closing (<node .../>) or have children.
  const element = /<(node|way|relation)\s([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
  for (const m of xml.matchAll(element)) {
    const a = attrs(m[2]);
    const body = m[4] ?? "";
    const tags = {};
    for (const t of body.matchAll(/<tag\s([^>]*?)\/>/g)) {
      const { k, v } = attrs(t[1]);
      tags[k] = v;
    }
    if (m[1] === "node") nodes.set(a.id, { lat: +a.lat, lon: +a.lon, tags });
    else if (m[1] === "way") {
      const refs = [...body.matchAll(/<nd ref="(\d+)"/g)].map((n) => n[1]);
      ways.set(a.id, { id: a.id, nodes: refs, tags });
    } else {
      const members = [...body.matchAll(/<member\s([^>]*?)\/>/g)].map((x) => attrs(x[1]));
      relations.set(a.id, { id: a.id, members, tags });
    }
  }
  return { nodes, ways, relations };
}

// Several .osm files (neighbouring areas) as one. The OSM API gives every
// way whole, so the same ids repeat across files with the same data.
export function read_osm_files(paths) {
  const all = { nodes: new Map(), ways: new Map(), relations: new Map() };
  for (const path of paths) {
    const osm = read_osm(path);
    for (const key of ["nodes", "ways", "relations"]) for (const [id, v] of osm[key]) all[key].set(id, v);
  }
  return all;
}

// Local tangent plane around (lat0, lon0): good to centimetres over a few km.
export function projection(lat0, lon0) {
  const k = (Math.PI / 180) * EARTH_RADIUS;
  const cos0 = Math.cos((lat0 * Math.PI) / 180);
  return {
    to_world: (lat, lon) => [(lon - lon0) * k * cos0, -(lat - lat0) * k],
    to_latlon: (x, z) => [lat0 - z / k, lon0 + x / (k * cos0)],
  };
}

// The way's points in world space [[x, z], ...] (nodes outside the file are skipped).
export function way_points(osm, way, proj) {
  const out = [];
  for (const id of way.nodes) {
    const n = osm.nodes.get(id);
    if (n) out.push(proj.to_world(n.lat, n.lon));
  }
  return out;
}

// Joins ways that share end nodes into longer chains of node ids. With
// `directed`, a way is only appended in its own direction (one-way roads).
export function chain_ways(ways, directed) {
  const pending = ways.map((w) => [...w.nodes]);
  const chains = [];
  while (pending.length) {
    let chain = pending.pop();
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i];
        const head = chain[0], tail = chain[chain.length - 1];
        let joined = null;
        if (w[0] === tail) joined = chain.concat(w.slice(1));
        else if (w[w.length - 1] === head) joined = w.concat(chain.slice(1));
        else if (!directed && w[w.length - 1] === tail) joined = chain.concat([...w].reverse().slice(1));
        else if (!directed && w[0] === head) joined = [...w].reverse().concat(chain.slice(1));
        if (joined) {
          chain = joined;
          pending.splice(i, 1);
          grown = true;
          break;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

// One-way roads (dual carriageways) joined into the longest drives, as
// chains of node ids. Where a road forks, the chain takes the straightest
// way; turns sharper than `max_turn` (radians) are never taken, so a chain
// doesn't U-turn where the two carriageways meet. Ways left over (slip
// roads, crossovers) are chains of their own. `xz(id)`: a node's [x, z].
export function chain_roads(ways, xz, max_turn = (75 * Math.PI) / 180) {
  const pending = new Set(ways.map((w) => w.nodes.filter(xz)).filter((n) => n.length > 1));
  const from = new Map(), to = new Map(); // node -> ways starting / ending there
  for (const w of pending) {
    if (!from.has(w[0])) from.set(w[0], []);
    if (!to.has(w.at(-1))) to.set(w.at(-1), []);
    from.get(w[0]).push(w);
    to.get(w.at(-1)).push(w);
  }
  const heading = (a, b) => {
    const [ax, az] = xz(a), [bx, bz] = xz(b);
    return Math.atan2(bx - ax, bz - az);
  };
  const turn = (h0, h1) => Math.abs(((h1 - h0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  // The straightest of `candidates` from direction h, or null.
  const best = (candidates, h, dir_of) => {
    let pick = null, least = max_turn;
    for (const w of candidates ?? []) {
      if (!pending.has(w)) continue;
      const t = turn(h, dir_of(w));
      if (t < least) (least = t), (pick = w);
    }
    return pick;
  };
  const length = (w) => {
    let d = 0;
    for (let i = 1; i < w.length; i++) d += Math.hypot(xz(w[i])[0] - xz(w[i - 1])[0], xz(w[i])[1] - xz(w[i - 1])[1]);
    return d;
  };
  const chains = [];
  // Longest ways first: they are the main road, not its slip roads.
  for (const seed of [...pending].sort((a, b) => length(b) - length(a))) {
    if (!pending.has(seed)) continue;
    pending.delete(seed);
    let chain = [...seed];
    for (;;) {
      const n = chain.length;
      const next = best(from.get(chain[n - 1]), heading(chain[n - 2], chain[n - 1]), (w) => heading(w[0], w[1]));
      if (!next) break;
      pending.delete(next);
      chain = chain.concat(next.slice(1));
    }
    for (;;) {
      const prev = best(to.get(chain[0]), heading(chain[0], chain[1]), (w) => heading(w.at(-2), w.at(-1)));
      if (!prev) break;
      pending.delete(prev);
      chain = prev.concat(chain.slice(1));
    }
    chains.push(chain);
  }
  return chains;
}

// Closed outer rings of a multipolygon relation (member ways joined), as node id lists.
export function relation_rings(osm, relation, role = "outer") {
  const ways = relation.members
    .filter((m) => m.type === "way" && (m.role || "outer") === role)
    .map((m) => osm.ways.get(m.ref))
    .filter(Boolean);
  return chain_ways(ways, false).filter((c) => c.length > 3 && c[0] === c[c.length - 1]);
}
