#ifndef VECTOR_H
#define VECTOR_H

#include <math.h>

typedef struct
{
    float x, y, z;
} vec3_t;

static inline vec3_t vec3_new(float x, float y, float z) { return (vec3_t){x, y, z}; }
static inline vec3_t vec3_from_ptr(const float *p) { return (vec3_t){p[0], p[1], p[2]}; }
static inline vec3_t vec3_add(vec3_t a, vec3_t b) { return (vec3_t){a.x + b.x, a.y + b.y, a.z + b.z}; }
static inline vec3_t vec3_sub(vec3_t a, vec3_t b) { return (vec3_t){a.x - b.x, a.y - b.y, a.z - b.z}; }
static inline vec3_t vec3_mul(vec3_t v, float f) { return (vec3_t){v.x * f, v.y * f, v.z * f}; }
static inline float vec3_dot(vec3_t a, vec3_t b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
static inline float vec3_length(vec3_t v) { return sqrtf(vec3_dot(v, v)); }

static inline vec3_t vec3_cross(vec3_t a, vec3_t b)
{
    return (vec3_t){
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x};
}

// Returns `fallback` when v has (almost) zero length instead of producing NaNs.
static inline vec3_t vec3_normalize_or(vec3_t v, vec3_t fallback)
{
    float len_sq = vec3_dot(v, v);
    if (len_sq < 1e-12f)
        return fallback;
    return vec3_mul(v, 1.0f / sqrtf(len_sq));
}

#endif
