#ifndef SHADOW_H
#define SHADOW_H

#include "matrix.h"

#define SHADOW_SIZE 512      // directional and spot maps: SHADOW_SIZE^2
#define SHADOW_CUBE_SIZE 256 // point lights: 6 faces of SHADOW_CUBE_SIZE^2

// A light's shadow map for the current frame.
//
// Every face stores "closeness" per texel (bigger = nearer the light, 0 =
// empty), which is linear in map space so it can be rasterized like depth:
//   orthographic (directional): closeness = (max_z - z) + 1
//   perspective (spot, point):  closeness = 1 / z
typedef struct
{
    float *map;
    int size;  // texels per side, per face
    int faces; // 1, or 6 for point lights (+x, -x, +y, -y, +z, -z)
    int ortho;
    // world -> face. Orthographic: gives (map x, map y, closeness) directly.
    // Perspective: gives light space (x, y, z), z along the face's axis.
    mat4_t world_to_face[6];
    float proj;     // perspective: x_map = size/2 * (1 + x * proj / z)
    float z_near;   // perspective: nothing closer is in the map
    float texel;    // orthographic: world size of a texel; perspective: per unit of distance
    vec3_t origin;  // perspective: the light's position (world)
} shadow_t;

// 0 = fully shadowed .. 1 = fully lit, at world position p with unit world
// normal n (the sample is pushed along n to avoid self-shadowing "acne").
// 2x2 percentage-closer filtering softens the edges.
static inline float shadow_visibility(const shadow_t *s, vec3_t p, vec3_t n)
{
    int face = 0;
    float offset;
    if (s->ortho)
        offset = 1.5f * s->texel;
    else
    {
        vec3_t d = vec3_sub(p, s->origin);
        offset = 1.5f * s->texel * sqrtf(vec3_dot(d, d));
        if (s->faces == 6)
        {
            float ax = fabsf(d.x), ay = fabsf(d.y), az = fabsf(d.z);
            if (ax >= ay && ax >= az) face = d.x >= 0 ? 0 : 1;
            else if (ay >= az) face = d.y >= 0 ? 2 : 3;
            else face = d.z >= 0 ? 4 : 5;
        }
    }
    p = vec3_add(p, vec3_mul(n, offset));

    const mat4_t *m = &s->world_to_face[face];
    vec3_t q = mat4_mul_point(m, p.x, p.y, p.z);
    const float half = 0.5f * (float)s->size;
    float u, v, c, bias;
    if (s->ortho)
    {
        u = q.x, v = q.y, c = q.z;
        bias = s->texel;
    }
    else
    {
        if (q.z <= s->z_near)
            return 1.0f;
        float iz = 1.0f / q.z;
        u = half + q.x * iz * s->proj * half;
        v = half - q.y * iz * s->proj * half;
        c = iz;
        bias = c * 0.002f;
    }

    // Bilinear weights of the 4 texels around (u, v); outside the map is lit.
    u -= 0.5f, v -= 0.5f;
    float fu = floorf(u), fv = floorf(v);
    int x0 = (int)fu, y0 = (int)fv;
    float wx = u - fu, wy = v - fv;
    const float *map = s->map + (size_t)face * s->size * s->size;
    const float limit = c + bias;
    float lit[4];
    for (int k = 0; k < 4; k++)
    {
        int x = x0 + (k & 1), y = y0 + (k >> 1);
        lit[k] = ((unsigned)x < (unsigned)s->size && (unsigned)y < (unsigned)s->size)
                     ? (map[y * s->size + x] > limit ? 0.0f : 1.0f)
                     : 1.0f;
    }
    return (lit[0] * (1.0f - wx) + lit[1] * wx) * (1.0f - wy) + (lit[2] * (1.0f - wx) + lit[3] * wx) * wy;
}

#endif
