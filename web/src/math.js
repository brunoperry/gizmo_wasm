export const vec3 = (x = 0, y = 0, z = 0) => {
  return { x: x, y: y, z: z };
};
export const vec3_from_buffer = (buffer) => {
  return vec3(buffer[0], buffer[1], buffer[2]);
};
export const vec3_lerp = (a, b, t) => {
  return vec3(a.x + t * (b.x - a.x), a.y + t * (b.x - a.y), a.z + t * (b.x - a.z));
};
export const vec3_negate = (vec) => {
  return vec3(-vec.x, -vec.y, -vec.z);
};
