#ifndef MATRIX_H
#define MATRIX_H

#include "vector.h"

// Row-major 4x4 matrix, column vectors: v' = M * v
typedef struct
{
    float m[4][4];
} mat4_t;

mat4_t mat4_identity(void);
mat4_t mat4_make_scale(vec3_t s);
mat4_t mat4_make_translation(vec3_t t);
mat4_t mat4_make_rotation(vec3_t angles); // Rx * Ry * Rz
mat4_t mat4_mul_mat4(mat4_t a, mat4_t b);
// Inverse of a rotation (orthonormal, may be mirrored) + translation.
mat4_t mat4_rigid_inverse(const mat4_t *m);

// Transforms a point (w = 1), ignoring the projective row.
static inline vec3_t mat4_mul_point(const mat4_t *m, float x, float y, float z)
{
    return (vec3_t){
        m->m[0][0] * x + m->m[0][1] * y + m->m[0][2] * z + m->m[0][3],
        m->m[1][0] * x + m->m[1][1] * y + m->m[1][2] * z + m->m[1][3],
        m->m[2][0] * x + m->m[2][1] * y + m->m[2][2] * z + m->m[2][3]};
}

// Transforms a direction (w = 0).
static inline vec3_t mat4_mul_dir(const mat4_t *m, vec3_t v)
{
    return (vec3_t){
        m->m[0][0] * v.x + m->m[0][1] * v.y + m->m[0][2] * v.z,
        m->m[1][0] * v.x + m->m[1][1] * v.y + m->m[1][2] * v.z,
        m->m[2][0] * v.x + m->m[2][1] * v.y + m->m[2][2] * v.z};
}

#endif
