// Vertex normals for meshes whose file has none.
//
// Each triangle corner gets the average of the normals of the triangles that
// share its point, weighted by the angle each one has there. Triangles that
// meet at more than `crease_angle` degrees don't mix, so the edges of a box stay
// sharp while a character's body comes out smooth. Points at the same position
// count as one point, so UV seams don't show up as lighting seams.
//
// points: 3 floats per point. corner_points: one point index per triangle corner,
// three per triangle (invalid indices skip the triangle). Returns 3 floats per
// corner. They point outwards for counter-clockwise triangles, as in the renderer.
// Corners of degenerate triangles get (0, 0, 0); the renderer then uses the face
// normal.
export const DEFAULT_CREASE_ANGLE = 60; // degrees

export function compute_normals(points, corner_points, crease_angle = DEFAULT_CREASE_ANGLE) {
  const corners = corner_points.length;
  const triangles = Math.floor(corners / 3);
  const num_points = Math.floor(points.length / 3);
  const out = new Float32Array(corners * 3);

  // Points at the same position share a group.
  const group_of_point = new Int32Array(num_points);
  const groups = new Map();
  for (let p = 0; p < num_points; p++) {
    const key = `${points[p * 3]},${points[p * 3 + 1]},${points[p * 3 + 2]}`;
    let group = groups.get(key);
    if (group === undefined) groups.set(key, (group = groups.size));
    group_of_point[p] = group;
  }

  // Per triangle: unit normal. Per corner: group and the corner's angle.
  const face = new Float32Array(triangles * 3);
  const angle = new Float32Array(corners);
  const corner_group = new Int32Array(corners).fill(-1);
  for (let t = 0; t < triangles; t++) {
    const i0 = corner_points[t * 3], i1 = corner_points[t * 3 + 1], i2 = corner_points[t * 3 + 2];
    if (!(i0 >= 0 && i1 >= 0 && i2 >= 0 && i0 < num_points && i1 < num_points && i2 < num_points)) continue;
    const ax = points[i0 * 3], ay = points[i0 * 3 + 1], az = points[i0 * 3 + 2];
    const bx = points[i1 * 3], by = points[i1 * 3 + 1], bz = points[i1 * 3 + 2];
    const cx = points[i2 * 3], cy = points[i2 * 3 + 1], cz = points[i2 * 3 + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 1e-20)) continue; // degenerate: contributes nothing
    face[t * 3] = nx / len, face[t * 3 + 1] = ny / len, face[t * 3 + 2] = nz / len;

    const corner_angle = (ux, uy, uz, vx, vy, vz) => {
      const cross = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      return Math.atan2(cross, ux * vx + uy * vy + uz * vz);
    };
    angle[t * 3] = corner_angle(e1x, e1y, e1z, e2x, e2y, e2z);
    angle[t * 3 + 1] = corner_angle(ax - bx, ay - by, az - bz, cx - bx, cy - by, cz - bz);
    angle[t * 3 + 2] = Math.PI - angle[t * 3] - angle[t * 3 + 1];
    corner_group[t * 3] = group_of_point[i0];
    corner_group[t * 3 + 1] = group_of_point[i1];
    corner_group[t * 3 + 2] = group_of_point[i2];
  }

  // Corners of each group, as one flat list (start offsets per group).
  const start = new Int32Array(groups.size + 1);
  for (let c = 0; c < corners; c++) if (corner_group[c] >= 0) start[corner_group[c] + 1]++;
  for (let g = 0; g < groups.size; g++) start[g + 1] += start[g];
  const fill = start.slice(0, groups.size);
  const members = new Int32Array(start[groups.size]);
  for (let c = 0; c < corners; c++) if (corner_group[c] >= 0) members[fill[corner_group[c]]++] = c;

  const min_cos = Math.cos((Math.min(Math.max(crease_angle, 0), 180) * Math.PI) / 180) - 1e-6;
  for (let c = 0; c < corners; c++) {
    const g = corner_group[c];
    if (g < 0) continue;
    const t = (c / 3) | 0;
    const fx = face[t * 3], fy = face[t * 3 + 1], fz = face[t * 3 + 2];
    let sx = 0, sy = 0, sz = 0;
    for (let m = start[g]; m < start[g + 1]; m++) {
      const other = members[m], o = ((other / 3) | 0) * 3;
      const ox = face[o], oy = face[o + 1], oz = face[o + 2];
      if (ox * fx + oy * fy + oz * fz < min_cos) continue;
      const w = angle[other];
      sx += ox * w, sy += oy * w, sz += oz * w;
    }
    const len = Math.hypot(sx, sy, sz);
    if (len > 1e-20) out[c * 3] = sx / len, out[c * 3 + 1] = sy / len, out[c * 3 + 2] = sz / len;
    else out[c * 3] = fx, out[c * 3 + 1] = fy, out[c * 3 + 2] = fz;
  }
  return out;
}
