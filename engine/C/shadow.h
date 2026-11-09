#ifndef SHADOW_H
#define SHADOW_H

#include <stdint.h>
#include "matrix.h"

#define SHADOW_SIZE 512      // directional and spot maps: SHADOW_SIZE^2
#define SHADOW_CUBE_SIZE 256 // point lights: 6 faces of SHADOW_CUBE_SIZE^2
// Each face also has a coarse "cover" grid, one byte per block of
// SHADOW_BLOCK^2 texels: 0 = nothing was drawn there, so a lookup is lit
// without reading the map (most of the ground around a few objects).
#define SHADOW_BLOCK_SHIFT 2
#define SHADOW_BLOCK (1 << SHADOW_BLOCK_SHIFT)

// A light's shadow map for the current frame.
//
// Every face stores "closeness" per texel (bigger = nearer the light, 0 =
// empty), which is linear in map space so it can be rasterized like depth:
//   orthographic (directional): closeness = (max_z - z) + 1
//   perspective (spot, point):  closeness = 1 / z
typedef struct
{
    float *map;
    unsigned char *cover; // (size / SHADOW_BLOCK)^2 per face, see SHADOW_BLOCK
    // Orthographic maps: a summed-area table of `cover`, (blocks + 1)^2. Entry
    // (x, y) counts the marked blocks left of x and above y, so any rectangle
    // of blocks is checked with 4 reads (shadow_span_lit).
    uint16_t *cover_sum;
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
    float fade;     // 1 / texels over which shadows fade out at the map's border; 0 = no fade
} shadow_t;

// Filtered lookup at texel position (u, v) of a face: 0 = fully shadowed ..
// 1 = fully lit, for a surface whose closeness (+ bias) is `limit`. 2x2
// percentage-closer filtering softens the edges; outside the map is lit.
static inline __attribute__((always_inline)) float shadow_sample(const shadow_t *s, int face, float u, float v, float limit)
{
    // The 4 texels around (u, v): which ones hold something closer.
    u -= 0.5f, v -= 0.5f;
    const float fu = floorf(u), fv = floorf(v);
    const int x0 = (int)fu, y0 = (int)fv, size = s->size;
    const float *map = s->map + (size_t)face * size * size;
    int dark[4];
    if ((unsigned)x0 < (unsigned)(size - 1) && (unsigned)y0 < (unsigned)(size - 1))
    {
        const int blocks = size >> SHADOW_BLOCK_SHIFT;
        if (!s->cover[((size_t)face * blocks + (y0 >> SHADOW_BLOCK_SHIFT)) * blocks + (x0 >> SHADOW_BLOCK_SHIFT)])
            return 1.0f;
        const float *row = map + y0 * size + x0;
        dark[0] = row[0] > limit, dark[1] = row[1] > limit;
        dark[2] = row[size] > limit, dark[3] = row[size + 1] > limit;
    }
    else
        for (int k = 0; k < 4; k++)
        {
            const int x = x0 + (k & 1), y = y0 + (k >> 1);
            dark[k] = (unsigned)x < (unsigned)size && (unsigned)y < (unsigned)size && map[y * size + x] > limit;
        }
    // Most samples are fully lit: nothing to filter or fade.
    const int count = dark[0] + dark[1] + dark[2] + dark[3];
    if (count == 0)
        return 1.0f;

    float visible = 0.0f;
    if (count < 4)
    {
        const float wx = u - fu, wy = v - fv;
        const float l0 = dark[0] ? 0.0f : 1.0f, l1 = dark[1] ? 0.0f : 1.0f;
        const float l2 = dark[2] ? 0.0f : 1.0f, l3 = dark[3] ? 0.0f : 1.0f;
        visible = (l0 * (1.0f - wx) + l1 * wx) * (1.0f - wy) + (l2 * (1.0f - wx) + l3 * wx) * wy;
    }
    if (s->fade > 0.0f)
    {
        // A map that follows the camera: its shadows fade out towards its
        // border instead of ending at a line.
        const float top = (float)(size - 1);
        float edge = u < top - u ? u : top - u;
        if (v < edge) edge = v;
        if (top - v < edge) edge = top - v;
        edge *= s->fade;
        if (edge < 1.0f)
            visible = edge > 0.0f ? 1.0f - (1.0f - visible) * edge : 1.0f;
    }
    return visible;
}

// 1 when every lookup on the way from texel position (u0, v0) to (u1, v1) of
// an orthographic map is sure to be fully lit: nothing was drawn in the
// blocks it crosses (outside the map counts as lit). 0 = can't tell, sample.
static inline __attribute__((always_inline)) int shadow_span_lit(const shadow_t *s, float u0, float v0, float u1, float v1)
{
    const int size = s->size, top = size - 1;
    // The first texel of each 2x2 lookup, as in shadow_sample.
    int xa = (int)floorf((u0 < u1 ? u0 : u1) - 0.5f), xb = (int)floorf((u0 < u1 ? u1 : u0) - 0.5f);
    int ya = (int)floorf((v0 < v1 ? v0 : v1) - 0.5f), yb = (int)floorf((v0 < v1 ? v1 : v0) - 0.5f);
    if (xb < -1 || yb < -1 || xa > top || ya > top)
        return 1;
    // A lookup at -1 reads texel 0, whose block is marked if it was drawn.
    xa = xa < 0 ? 0 : xa, ya = ya < 0 ? 0 : ya;
    xb = xb > top ? top : xb, yb = yb > top ? top : yb;
    const int stride = (size >> SHADOW_BLOCK_SHIFT) + 1;
    const uint16_t *above = s->cover_sum + (ya >> SHADOW_BLOCK_SHIFT) * stride;
    const uint16_t *below = s->cover_sum + ((yb >> SHADOW_BLOCK_SHIFT) + 1) * stride;
    const int left = xa >> SHADOW_BLOCK_SHIFT, right = (xb >> SHADOW_BLOCK_SHIFT) + 1;
    return below[right] - below[left] == above[right] - above[left];
}

// How far a sample is pushed along the surface normal to avoid
// self-shadowing "acne", and the closeness bias, for orthographic maps.
static inline float shadow_ortho_offset(const shadow_t *s) { return 1.5f * s->texel; }
static inline float shadow_ortho_bias(const shadow_t *s) { return s->texel; }

// 0 = fully shadowed .. 1 = fully lit, at world position p with unit world
// normal n (the sample is pushed along n).
static inline float shadow_visibility(const shadow_t *s, vec3_t p, vec3_t n)
{
    int face = 0;
    float offset;
    if (s->ortho)
        offset = shadow_ortho_offset(s);
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
    if (s->ortho)
        return shadow_sample(s, face, q.x, q.y, q.z + shadow_ortho_bias(s));

    if (q.z <= s->z_near)
        return 1.0f;
    const float half = 0.5f * (float)s->size;
    const float iz = 1.0f / q.z;
    return shadow_sample(s, face, half + q.x * iz * s->proj * half, half - q.y * iz * s->proj * half, iz * 1.002f);
}

#endif
