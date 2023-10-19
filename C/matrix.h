#ifndef MATRIX_H
#define MATRIX_H

#include <math.h>
#include "vector.h"
#include "wasm.h"

//////////////////////////////////////
// Matrix Operations
//////////////////////////////////////
typedef struct
{
    float m[4][4];
} mat4_t;

mat4_t mat4_identity(void);
mat4_t mat4_make_scale(float sx, float sy, float sz);
// mat4_t mat4_make_translation(float tx, float ty, float tz);
mat4_t mat4_make_translation(vec3_t t);
mat4_t mat4_make_rotation(vec3_t rot);
mat4_t mat4_make_rotation_x(float angle);
mat4_t mat4_make_rotation_y(float angle);
mat4_t mat4_make_rotation_z(float angle);
mat4_t mat4_mul_mat4(mat4_t a, mat4_t b);
vec4_t mat4_mul_vec4(mat4_t m, vec4_t v);
vec3_t mat4_mul_vec3(mat4_t m, vec3_t v);
mat4_t mat4_make_perspective(float fov, float aspect, float znear, float zfar);
vec4_t mat4_mul_vec4_project(mat4_t mat_proj, vec4_t v);
mat4_t mat4_look_at(vec3_t eye, vec3_t center, vec3_t up);

void mat4_log(mat4_t mat);

#endif