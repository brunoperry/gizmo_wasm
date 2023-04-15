export const vec3 = (x = 0, y = 0, z = 0) => {
  return { x: x, y: y, z: z };
};
export const vec3_length = (v) => {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

export const vec3_scale = (v, s) => {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
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
// Vec4
/////////

export const vec4 = (x, y, z, w) => {
  return { x: x, y: y, z: z, w: w };
};
export const vec4_divide_scalar = (vector, scalar) => {
  const result = vec3();
  result.x = vector.x / scalar;
  result.y = vector.y / scalar;
  result.z = vector.z / scalar;
  return result;
};
export const vec4_from_vec3 = (v) => {
  return vec4(v.x, v.y, v.z, 1.0);
};
export const vec4_divide_scalar_2d = (vector, scalar) => {
  const result = vec3();
  result.x = vector.x / scalar;
  result.y = vector.y / scalar;
  result.z = 0;
  return result;
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

export const mat4_make_scale = (s) => {
  const m = mat4_identity();
  m[0][0] = s.x;
  m[1][1] = s.y;
  m[2][2] = s.z;
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
  let m = mat4_identity();

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
export const mat4_mul_vec4 = (m, v) => {
  const result = vec4();
  result.x = m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z + m[0][3] * v.w;
  result.y = m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z + m[1][3] * v.w;
  result.z = m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z + m[2][3] * v.w;
  result.w = m[3][0] * v.x + m[3][1] * v.y + m[3][2] * v.z + m[3][3] * v.w;

  return result;
};

export const mat4_make_model = (transform) => {
  const m = mat4_identity();

  const t = mat4_make_translation(transform.position);
  const r = mat4_make_rotation(transform.rotation);
  const s = mat4_make_scale(transform.scale);

  return mat4_mul_mat4(mat4_mul_mat4(t, r), s);
};
export const mat4_make_view = (position, target, up) => {
  const zAxis = vec3_normalize(vec3_sub(position, target));

  const xAxis = vec3_normalize(vec3_cross(up, zAxis));
  const yAxis = vec3_normalize(vec3_cross(zAxis, xAxis));

  const translation = vec3_scale(position, -1);

  const rotation = mat4_identity();
  rotation[0] = [xAxis.x, yAxis.x, zAxis.x, 0];
  rotation[1] = [xAxis.y, yAxis.y, zAxis.y, 0];
  rotation[2] = [xAxis.z, yAxis.z, zAxis.z, 0];
  rotation[3] = [0, 0, 0, 1];

  return mat4_mul_mat4(rotation, mat4_make_translation(translation));
};
export const mat4_make_perspective = (fov, aspect, near, far) => {
  const m = mat4_zero();
  m[0][0] = aspect * (1.0 / Math.tan(fov / 2.0));
  m[1][1] = 1.0 / Math.tan(fov / 2.0);
  m[2][2] = far / (far - near);
  m[2][3] = (-far * near) / (far - near);
  m[3][2] = 1.0;

  return m;
};

export const mat4_to_buffer = (mat4) => {
  return mat4.flatMap((row) => [...row]);
};

export const mat4_from_quat = (q) => {
  const m = mat4_zero();

  const xx = q.x * q.x;
  const xy = q.x * q.y;
  const xz = q.x * q.z;
  const xw = q.x * q.w;

  const yy = q.y * q.y;
  const yz = q.y * q.z;
  const yw = q.y * q.w;

  const zz = q.z * q.z;
  const zw = q.z * q.w;

  m[0][0] = 1.0 - 2.0 * (yy + zz);
  m[0][1] = 2.0 * (xy - zw);
  m[0][2] = 2.0 * (xz + yw);

  m[1][0] = 2.0 * (xy + zw);
  m[1][1] = 1.0 - 2.0 * (xx + zz);
  m[1][2] = 2.0 * (yz - xw);

  m[2][0] = 2.0 * (xz - yw);
  m[2][1] = 2.0 * (yz + xw);
  m[2][2] = 1.0 - 2.0 * (xx + yy);

  m[3][3] = 1.0;

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

export const quat_conjugate = (q) => {
  return quat(-q.x, -q.y, -q.z, q.w);
};
