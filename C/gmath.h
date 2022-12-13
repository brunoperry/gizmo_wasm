#ifndef M_PI
// clang-format off
#define M_PI     3.141592653589
#define M_PI2    6.283185307179
#define M_PI_SQR 9.869604401089
#define M_PID2   1.570796326794
// clang-format on
#endif

#ifndef GMATH_H
#define GMATH_H

#include <math.h>
#include <stdint.h>

//////////////////////////////////////
// Texture coordinates Operations
//////////////////////////////////////
typedef struct
{
    float u;
    float v;
} tex2_t;
tex2_t tex2_clone(tex2_t *t);

////////////////////////////////////////////////////////////////////////////////
// Vector 2 Operations
////////////////////////////////////////////////////////////////////////////////
typedef struct
{
    float x, y;
} vec2_t;
float vec2_length(vec2_t v);
vec2_t vec2_add(vec2_t a, vec2_t b);
vec2_t vec2_sub(vec2_t a, vec2_t b);
vec2_t vec2_mul(vec2_t v, float factor);
vec2_t vec2_div(vec2_t v, float factor);
void vec2_normalize(vec2_t *v);

//////////////////////////////////////
// Vector 3D Operations
//////////////////////////////////////
typedef struct
{
    float x, y, z;
} vec3_t;
vec3_t vec3_new(float x, float y, float z);
float vec3_length(vec3_t v);
vec3_t vec3_add(vec3_t a, vec3_t b);
vec3_t vec3_sub(vec3_t a, vec3_t b);
vec3_t vec3_mul(vec3_t v, float factor);
vec3_t vec3_div(vec3_t v, float factor);
vec3_t vec3_cross(vec3_t a, vec3_t b);
float vec3_dot(vec3_t a, vec3_t b);
void vec3_normalize(vec3_t *v);
void vec3_negate(vec3_t *v);
vec3_t vec3_rotate_x(vec3_t v, float angle);
vec3_t vec3_rotate_y(vec3_t v, float angle);
vec3_t vec3_rotate_z(vec3_t v, float angle);
vec3_t vec3_clone(vec3_t *v);

//////////////////////////////////////
// Vector 4D Operations
//////////////////////////////////////
typedef struct
{
    float x, y, z, w;
} vec4_t;
vec4_t vec4_clone(vec4_t *v);
vec4_t vec4_new(float x, float y, float z, float w);

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

///////////////////////////////////////////////////////////////////////////////
// Vector conversion funcs
///////////////////////////////////////////////////////////////////////////////
vec4_t vec4_from_vec3(vec3_t v);
vec3_t vec3_from_vec4(vec4_t v);
vec2_t vec2_from_vec4(vec4_t v);

///////////////////////////////////////////////////////////////////////////////
// Math funcs
///////////////////////////////////////////////////////////////////////////////
float g_aTan2(float y, float x);
float g_tan(float x);
float g_cos(float x);
float g_sin(float x);
int g_abs(int n);
float g_fabs(float n);

///////////////////////////////////////////////////////////////////////////////
// Utils funcs
///////////////////////////////////////////////////////////////////////////////
vec3_t barycentric_weights(vec2_t a, vec2_t b, vec2_t c, vec2_t p);
void int_swap(int *a, int *b);
void float_swap(float *a, float *b);
float float_lerp(float a, float b, float t);

#endif