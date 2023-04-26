/////////
// Vec3
/////////
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
export const VEC3_UP = vec3(0, 1, 0);
export const VEC3_RIGHT = vec3(1, 0, 0);
export const VEC3_FORWARD = vec3(0, 0, 1);
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
// Matrix3
/////////
export const mat3_identity = () => {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
};
export const mat3_inertia = (x, y, z) => {
  return [
    [x, 0, 0],
    [0, y, 0],
    [0, 0, z],
  ];
};
export const mat3_mul_vec3 = (m, v) => {
  const result = vec3();
  result.x = m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z;
  result.y = m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z;
  result.z = m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z;

  return result;
};
export const mat3_mul_mat3 = (a, b) => {
  const m = mat3_identity();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      m[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return m;
};
export const mat3_inverse = (mat) => {
  const a11 = mat[0][0];
  const a12 = mat[0][1];
  const a13 = mat[0][2];
  const a21 = mat[1][0];
  const a22 = mat[1][1];
  const a23 = mat[1][2];
  const a31 = mat[2][0];
  const a32 = mat[2][1];
  const a33 = mat[2][2];

  const det =
    a11 * (a22 * a33 - a32 * a23) -
    a21 * (a12 * a33 - a32 * a13) +
    a31 * (a12 * a23 - a22 * a13);

  const b11 = (a22 * a33 - a32 * a23) / det;
  const b12 = -(a12 * a33 - a32 * a13) / det;
  const b13 = (a12 * a23 - a22 * a13) / det;
  const b21 = -(a21 * a33 - a31 * a23) / det;
  const b22 = (a11 * a33 - a31 * a13) / det;
  const b23 = -(a11 * a23 - a21 * a13) / det;
  const b31 = (a21 * a32 - a31 * a22) / det;
  const b32 = -(a11 * a32 - a31 * a12) / det;
  const b33 = (a11 * a22 - a21 * a12) / det;

  return [
    [b11, b12, b13],
    [b21, b22, b23],
    [b31, b32, b33],
  ];
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
export const mat4_make_rotation_quat = (quat) => {
  const xx = quat.x * quat.x;
  const xy = quat.x * quat.y;
  const xz = quat.x * quat.z;
  const xw = quat.x * quat.w;
  const yy = quat.y * quat.y;
  const yz = quat.y * quat.z;
  const yw = quat.y * quat.w;
  const zz = quat.z * quat.z;
  const zw = quat.z * quat.w;

  const out = mat4_identity();

  out[0] = [1 - 2 * (yy + zz), 2 * (xy - zw), 2 * (xz + yw), 0];
  out[1] = [2 * (xy + zw), 1 - 2 * (xx + zz), 2 * (yz - xw), 0];
  out[2] = [2 * (xz - yw), 2 * (yz + xw), 1 - 2 * (xx + yy), 0];
  out[3] = [0, 0, 0, 1];

  return out;
};
export const mat4_make_rotation = (rot) => {
  const rotationXMatrix = mat4_make_rotation_x(radians(rot.x));
  const rotationYMatrix = mat4_make_rotation_y(radians(rot.y));
  const rotationZMatrix = mat4_make_rotation_z(radians(rot.z));

  return mat4_mul_mat4(mat4_mul_mat4(rotationZMatrix, rotationYMatrix), rotationXMatrix);
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
  const translationMatrix = mat4_make_translation(transform.position);
  const rotationMatrix = mat4_make_rotation(transform.rotation);
  const scaleMatrix = mat4_make_scale(transform.scale);
  return mat4_mul_mat4(mat4_mul_mat4(translationMatrix, rotationMatrix), scaleMatrix);
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
  const f = 1.0 / Math.tan(radians(fov) / 2.0);
  const nf = 1.0 / (near - far);

  const m = mat4_zero();
  m[0][0] = f / aspect;
  m[1][1] = f;
  m[2][2] = (near + far) * nf;
  m[2][3] = -1.0 * near * far * nf;
  m[3][2] = 1;

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
export const quat = (w = 0, x = 0, y = 0, z = 0) => {
  return { w: w, x: x, y: y, z: z };
};
export const quat_from_vec = (vec) => {
  return quat(0, vec.x, vec.y, vec.z);
};
export const quat_from_axis_angle = (axis, angle) => {
  const halfAngle = angle / 2;
  const sin = Math.sin(halfAngle);
  const cos = Math.cos(halfAngle);

  return quat(cos, sin * axis.x, sin * axis.y, sin * axis.z);
};
export const quat_multiply = (q1, q2) => {
  const out = quat(1, 0, 0, 0);
  out.w = q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z;
  out.x = q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y;
  out.y = q1.w * q2.y + q1.y * q2.w + q1.z * q2.x - q1.x * q2.z;
  out.z = q1.w * q2.z + q1.z * q2.w + q1.x * q2.y - q1.y * q2.x;
  return out;
};
export const quat_conjugate = (q) => {
  return quat(-q.x, -q.y, -q.z, q.w);
};
export const quat_euler = (x, y, z) => {
  const qx = quat_from_axis_angle(VEC3_RIGHT, x);
  const qy = quat_from_axis_angle(VEC3_UP, y);
  const qz = quat_from_axis_angle(VEC3_FORWARD, z);

  return quat_multiply(quat_multiply(qx, qy), qz);
};
export const quat_normalize = (q) => {
  const out = quat(q.w, q.x, q.y, q.z);
  const length = Math.sqrt(out.w * out.w + out.x * out.x + out.y * out.y + out.z * out.z);
  if (length === 0) {
    out.w = 1;
    out.x = 0;
    out.y = 0;
    out.z = 0;
  } else {
    const invLength = 1 / length;
    out.w *= invLength;
    out.x *= invLength;
    out.y *= invLength;
    out.z *= invLength;
  }
  return out;
};
export const quat_to_matrix = (quat) => {
  const { x, y, z, w } = quat;
  const xx = x * x;
  const xy = x * y;
  const xz = x * z;
  const xw = x * w;
  const yy = y * y;
  const yz = y * z;
  const yw = y * w;
  const zz = z * z;
  const zw = z * w;

  const row1 = [1 - 2 * (yy + zz), 2 * (xy - zw), 2 * (xz + yw), 0];
  const row2 = [2 * (xy + zw), 1 - 2 * (xx + zz), 2 * (yz - xw), 0];
  const row3 = [2 * (xz - yw), 2 * (yz + xw), 1 - 2 * (xx + yy), 0];
  const row4 = [0, 0, 0, 1];

  return [row1, row2, row3, row4];
};

const radians = (degrees) => {
  return (degrees * Math.PI) / 180.0;
};
