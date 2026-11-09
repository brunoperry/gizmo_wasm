// Marginal's textures, generated so they can be tweaked in code:
//   palette.png: 16x16 solid colors; flat-colored meshes point their UVs at
//     one texel (see palette_uv), so a whole tile is one object/texture.
//   road.png: asphalt with lane markings, tiled along the road (v) and
//     split in 4 lane variants across (u), see ROAD_LANES.
import { write_png } from "./png.mjs";

export const PALETTE_SIZE = 16;
export const PALETTE = {
  land: "#8d9560",
  grass: "#6f8b45",
  sea: "#2e6a93",
  river: "#3b7ca3",
  seawall: "#a39d90",
  street: "#55555a",
  sidewalk: "#b8b2a6",
  median: "#a9a69e",
  ballast: "#6e645b",
  rail: "#3b3b3e",
  pier: "#8c7b67",
  roof_tile: "#b0553e",
  roof_flat: "#8e8c88",
  roof_dark: "#6c6a68",
  wall_white: "#ece6d8",
  wall_cream: "#e6d3a3",
  wall_ochre: "#dcb27c",
  wall_pink: "#d79c90",
  wall_grey: "#c4cdd2",
  wall_yellow: "#e9cd6c",
  car_body: "#c8102e",
  car_glass: "#1e252d",
  car_tyre: "#19191a",
  car_light: "#f5f0cc",
  car_tail: "#7a0d12",
  car_trim: "#2c2c30",
  car_hub: "#c9ccd0",
};
export const WALLS = ["wall_white", "wall_cream", "wall_ochre", "wall_pink", "wall_grey", "wall_yellow"];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// The UV of a palette color's texel center (V up, as in USD).
export function palette_uv(name) {
  const i = Object.keys(PALETTE).indexOf(name);
  if (i < 0) throw new Error(`No palette color "${name}"`);
  const x = i % PALETTE_SIZE, y = Math.floor(i / PALETTE_SIZE);
  return [(x + 0.5) / PALETTE_SIZE, 1 - (y + 0.5) / PALETTE_SIZE];
}

// Road texture: ROAD_W x ROAD_H texels, one lane is LANE_TEXELS wide and the
// pattern repeats every ROAD_REPEAT metres along the road.
export const ROAD_W = 128, ROAD_H = 128, LANE_TEXELS = 32;
export const LANE_WIDTH = 3.25; // metres
export const ROAD_REPEAT = 12.8; // metres per texture height (10 texels / m)
// Lane variants (column of the texture): which lines each lane draws.
export const ROAD_LANES = {
  only: 0, // solid line on both sides (1 lane)
  first: 1, // solid left, dashed right
  middle: 2, // dashed right (the lane on its left draws the other line)
  last: 3, // solid right (the lane on its left draws the dashed line)
};
// U range of a variant, inset half a texel so nearest sampling stays inside.
export function lane_u(variant) {
  const inset = 0.5 / ROAD_W;
  return [(variant * LANE_TEXELS) / ROAD_W + inset, ((variant + 1) * LANE_TEXELS) / ROAD_W - inset];
}

// Small deterministic noise, so the asphalt isn't a flat color.
const noise = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xff) / 255;
};

export function write_textures(dir) {
  // Palette
  const p = new Uint8Array(PALETTE_SIZE * PALETTE_SIZE * 4);
  Object.values(PALETTE).forEach((color, i) => {
    const [r, g, b] = hex(color);
    p.set([r, g, b, 255], i * 4);
  });
  write_png(`${dir}/palette.png`, PALETTE_SIZE, PALETTE_SIZE, p);

  // Road
  const r = new Uint8Array(ROAD_W * ROAD_H * 4);
  const white = [228, 226, 216];
  for (let y = 0; y < ROAD_H; y++) {
    for (let x = 0; x < ROAD_W; x++) {
      const lane = Math.floor(x / LANE_TEXELS), lx = x % LANE_TEXELS;
      const n = noise(x, y);
      const base = 70 + Math.round((n - 0.5) * 10);
      let c = [base, base, base + 3];
      const solid_left = lane === ROAD_LANES.only || lane === ROAD_LANES.first;
      const solid_right = lane === ROAD_LANES.only || lane === ROAD_LANES.last;
      const dashed_right = lane === ROAD_LANES.first || lane === ROAD_LANES.middle;
      // Lines are 2 texels (~20 cm), 1 texel in from the edge.
      if (solid_left && (lx === 1 || lx === 2)) c = white;
      if (solid_right && (lx === LANE_TEXELS - 3 || lx === LANE_TEXELS - 2)) c = white;
      // Dashes: 4 m painted, 8.8 m gap; on the lane edge, so the next lane
      // has nothing to draw there.
      if (dashed_right && lx >= LANE_TEXELS - 2 && y < 40) c = white;
      // Tyre wear: slightly darker bands in the middle of each wheel track.
      if (Math.abs(lx - 9) < 3 || Math.abs(lx - 23) < 3) c = c === white ? c : c.map((v) => v - 6);
      r.set([...c, 255], (y * ROAD_W + x) * 4);
    }
  }
  write_png(`${dir}/road.png`, ROAD_W, ROAD_H, r);
}
