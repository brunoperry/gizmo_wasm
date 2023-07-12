export const vec3 = (x = 0, y = 0, z = 0) => {
  return { x: x, y: y, z: z };
};
export const vec3_length = (v) => {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};
export const vec3_add = (a, b) => {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
};
export const vec3_sub = (a, b) => {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
};
export const vec3_mul = (a, b) => {
  return vec3(a.x * b.x, a.y * b.y, a.z * b.z);
};
export const vec3_mul_scalar = (vec, scalar) => {
  return vec3(vec.x * scalar, vec.y * scalar, vec.z * scalar);
};
export const vec3_div = (a, b) => {
  return vec3(a.x / b.x, a.y / b.y, a.z / b.z);
};
export const vec3_from_buffer = (buffer) => {
  return vec3(buffer[0], buffer[1], buffer[2]);
};
export const vec3_to_buffer = (v) => {
  return [v.x, v.y, v.z];
};
export const vec3_cross = (a, b) => {
  return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
};
export const vec3_dot = (a, b) => {
  return a.x * b.x + a.y * b.y + a.z * b.z;
};
export const vec3_normalize = (v) => {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  v.x /= length;
  v.y /= length;
  v.z /= length;
  return v;
};
export const vec3_negate = (v) => {
  return vec3(-v.x, -v.y, -v.z);
};

/////////
// Matrix4
/////////
export const mat4_identity = () => {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
};
export const mat4_zero = () => {
  return [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
};

export const mat4_make_scale = (sx = 1, sy = 1, sz = 1) => {
  const m = mat4_identity();
  m[0][0] = sx;
  m[1][1] = sy;
  m[2][2] = sz;
  return m;
};
export const mat4_make_translation = (t) => {
  const m = mat4_identity();
  m[0][3] = t.x;
  m[1][3] = t.y;
  m[2][3] = t.z;
  return m;
};
export const mat4_make_rotation = (rot) => {
  const m = mat4_identity();

  const rotation_matrix_x = mat4_make_rotation_x(rot.x);
  const rotation_matrix_y = mat4_make_rotation_y(rot.y);
  const rotation_matrix_z = mat4_make_rotation_z(rot.z);

  m = mat4_mul_mat4(rotation_matrix_z, m);
  m = mat4_mul_mat4(rotation_matrix_y, m);
  m = mat4_mul_mat4(rotation_matrix_x, m);

  return m;
};

export const mat4_make_rotation_x = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = mat4_identity();
  m[1][1] = c;
  m[1][2] = -s;
  m[2][1] = s;
  m[2][2] = c;
  return m;
};
export const mat4_make_rotation_y = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = mat4_identity();
  m[0][0] = c;
  m[0][2] = s;
  m[2][0] = -s;
  m[2][2] = c;
  return m;
};
export const mat4_make_rotation_z = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = mat4_identity();
  m[0][0] = c;
  m[0][1] = -s;
  m[1][0] = s;
  m[1][1] = c;
  return m;
};

export const mat4_mul_mat4 = (a, b) => {
  const m = mat4_identity();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      m[i][j] =
        a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] + a[i][3] * b[3][j];
    }
  }
  return m;
};
export const mat4_mul_vec3 = (m, v) => {
  const result = vec3();
  result.x = m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z + m[0][3] * v.w;
  result.y = m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z + m[1][3] * v.w;
  result.z = m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z + m[2][3] * v.w;
  result.w = m[3][0] * v.x + m[3][1] * v.y + m[3][2] * v.z + m[3][3] * v.w;

  return result;
};

export const mat4_make_perspective = (fov, aspect, znear, zfar) => {
  const m = mat4_zero();
  m[0][0] = aspect * (1 / Math.tan(fov / 2));
  m[1][1] = 1 / Math.tan(fov / 2);
  m[2][2] = zfar / (zfar - znear);
  m[2][3] = (-zfar * znear) / (zfar - znear);
  m[3][2] = 1.0;
  return m;
};

export const mat4_mul_vec3_project = (mat_proj, v) => {
  // multiply the projection matrix by our original vector
  const result = mat4_mul_vec3(mat_proj, v);

  // perform perspective divide with original z-value that is now stored in w
  if (result.w != 0.0) {
    result.x /= result.w;
    result.y /= result.w;
    result.z /= result.w;
  }
  return result;
};

/////////
// Quaternions
////////
export const quat = (w, x, y, z) => {
  return { w: w, x: x, y: y, z: z };
};
export const quat_from_axis_angle = (x, y, z, angle) => {
  const quat = quat();
  quat.w = Math.cos(angle / 2);
  quat.x = x * Math.sin(angle / 2);
  quat.y = y * Math.sin(angle / 2);
  quat.z = z * Math.sin(angle / 2);
  return quat;
};
export const quat_multiply = (q1, q2) => {
  const quat = quat();
  quat.w = q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z;
  quat.x = q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y;
  quat.y = q1.w * q2.y + q1.y * q2.w + q1.z * q2.x - q1.x * q2.z;
  quat.z = q1.w * q2.z + q1.z * q2.w + q1.x * q2.y - q1.y * q2.x;
  return quat;
};
