export const vec3 = (x = 0, y = 0, z = 0) => {
  return { x: x, y: y, z: z };
};
export const vec3_cross = (a, b) => {
  return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
};
export const vec3_scale_and_add = (currentVector, otherVector, scale) => {
  currentVector.x += otherVector.x * scale;
  currentVector.y += otherVector.y * scale;
  currentVector.z += otherVector.z * scale;
  return currentVector;
};
export const vec3_transform_mat4 = (a, m) => {
  let x = a.x,
    y = a.y,
    z = a.z;

  let w = m[0][3] * x + m[1][3] * y + m[2][3] * z + m[3][3];
  w = w || 1.0;

  return vec3(
    (m[0][0] * x + m[1][0] * y + m[2][0] * z + m[3][0]) / w,
    (m[0][1] * x + m[1][1] * y + m[2][1] * z + m[3][1]) / w,
    (m[0][2] * x + m[1][2] * y + m[2][2] * z + m[3][2]) / w
  );
};
/////////
// Matrix4
/////////
export const mat4_ELIPSON = 1.4013e-45;

export const mat4_from_rotation = (rad, axis) => {
  let x = axis.x,
    y = axis.y,
    z = axis.z;
  let len = Math.hypot(x, y, z);
  let s, c, t;
  if (len < mat4_ELIPSON) {
    return null;
  }
  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;

  // Perform rotation-specific matrix multiplication
  return [
    [x * x * t + c, y * x * t + z * s, z * x * t - y * s, 0],
    [x * y * t - z * s, y * y * t + c, z * y * t + x * s, 0],
    [x * z * t + y * s, y * z * t - x * s, z * z * t + c, 0],
    [0, 0, 0, 1],
  ];
};
