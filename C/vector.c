#include "vector.h"

///////////////////////////////////////////////////////////////////////////////
// Texture coordinates Implementations
///////////////////////////////////////////////////////////////////////////////
inline tex2_t tex2_clone(tex2_t *t)
{
    tex2_t result = {t->u, t->v};
    return result;
}

///////////////////////////////////////////////////////////////////////////////
// Vector 2D Implementations
///////////////////////////////////////////////////////////////////////////////
inline float vec2_length(vec2_t v)
{
    return sqrt(v.x * v.x + v.y * v.y);
}
inline vec2_t vec2_add(vec2_t a, vec2_t b)
{
    vec2_t result = {
        .x = a.x + b.x,
        .y = a.y + b.y};
    return result;
}
inline vec2_t vec2_sub(vec2_t a, vec2_t b)
{
    vec2_t result = {
        .x = a.x - b.x,
        .y = a.y - b.y};
    return result;
}
inline vec2_t vec2_mul(vec2_t v, float factor)
{
    vec2_t result = {
        .x = v.x * factor,
        .y = v.y * factor};
    return result;
}
inline vec2_t vec2_div(vec2_t v, float factor)
{
    vec2_t result = {
        .x = v.x / factor,
        .y = v.y / factor};
    return result;
}
inline float vec2_dot(vec2_t a, vec2_t b)
{
    return (a.x * b.x) + (a.y * b.y);
}
inline void vec2_normalize(vec2_t *v)
{
    float length = sqrt(v->x * v->x + v->y * v->y);
    v->x /= length;
    v->y /= length;
}

//////////////////////////////////////
// Vector 3D Implementations
//////////////////////////////////////
inline float vec3_length(vec3_t v)
{
    return sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
inline vec3_t vec3_add(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.x + b.x,
        .y = a.y + b.y,
        .z = a.z + b.z};
    return result;
}
inline vec3_t vec3_sub(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.x - b.x,
        .y = a.y - b.y,
        .z = a.z - b.z};
    return result;
}
inline vec3_t vec3_mul(vec3_t v, float factor)
{
    vec3_t result = {
        .x = v.x * factor,
        .y = v.y * factor,
        .z = v.z * factor};
    return result;
}
inline vec3_t vec3_div(vec3_t v, float factor)
{
    vec3_t result = {
        .x = v.x / factor,
        .y = v.y / factor,
        .z = v.z / factor};
    return result;
}
inline vec3_t vec3_cross(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.y * b.z - a.z * b.y,
        .y = a.z * b.x - a.x * b.z,
        .z = a.x * b.y - a.y * b.x};
    return result;
}
inline float vec3_dot(vec3_t a, vec3_t b)
{
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}
inline void vec3_normalize(vec3_t *v)
{
    float length = sqrt(v->x * v->x + v->y * v->y + v->z * v->z);
    v->x /= length;
    v->y /= length;
    v->z /= length;
}
inline void vec3_negate(vec3_t *v)
{
    v->x = -v->x;
    v->y = -v->y;
    v->z = -v->z;
}
inline vec3_t vec3_rotate_x(vec3_t v, float angle)
{
    vec3_t rotated_vector = {
        .x = v.x,
        .y = v.y * cos(angle) - v.z * sin(angle),
        .z = v.y * sin(angle) + v.z * cos(angle)};
    return rotated_vector;
}
inline vec3_t vec3_rotate_y(vec3_t v, float angle)
{
    vec3_t rotated_vector = {
        .x = v.x * cos(angle) + v.z * sin(angle),
        .y = v.y,
        .z = -v.x * sin(angle) + v.z * cos(angle)};
    return rotated_vector;
}
inline vec3_t vec3_rotate_z(vec3_t v, float angle)
{
    vec3_t rotated_vector = {
        .x = v.x * cos(angle) - v.y * sin(angle),
        .y = v.x * sin(angle) + v.y * cos(angle),
        .z = v.z};
    return rotated_vector;
}
inline vec3_t vec3_clone(vec3_t *v)
{
    vec3_t result = {v->x, v->y, v->z};
    return result;
}
inline vec3_t vec3_new(float x, float y, float z)
{
    return (vec3_t){.x = x, .y = y, .z = z};
}
inline void vec3_log(vec3_t vec)
{
    wasm_vec3_log(vec.x, vec.y, vec.z);
}

//////////////////////////////////////
// Vector 4D Implementations
//////////////////////////////////////
inline vec4_t vec4_new(float x, float y, float z, float w)
{
    return (vec4_t){.x = x, .y = y, .z = z, .w = w};
}
inline vec4_t vec4_clone(vec4_t *v)
{
    vec4_t result = {v->x, v->y, v->z, v->w};
    return result;
}
inline void vec4_log(vec4_t vec)
{
    wasm_vec4_log(vec.x, vec.y, vec.z, vec.w);
}

//////////////////////////////////////
// Vector conversion funcs
//////////////////////////////////////
inline vec4_t vec4_from_vec3(vec3_t v)
{
    vec4_t result = {v.x, v.y, v.z, 1.0};
    return result;
}
inline vec3_t vec3_from_vec4(vec4_t v)
{
    vec3_t result = {v.x, v.y, v.z};
    return result;
}
inline vec2_t vec2_from_vec4(vec4_t v)
{
    vec2_t result = {v.x, v.y};
    return result;
}