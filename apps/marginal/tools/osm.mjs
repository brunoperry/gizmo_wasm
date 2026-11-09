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

// Closed outer rings of a multipolygon relation (member ways joined), as node id lists.
export function relation_rings(osm, relation, role = "outer") {
  const ways = relation.members
    .filter((m) => m.type === "way" && (m.role || "outer") === role)
    .map((m) => osm.ways.get(m.ref))
    .filter(Boolean);
  return chain_ways(ways, false).filter((c) => c.length > 3 && c[0] === c[c.length - 1]);
}
