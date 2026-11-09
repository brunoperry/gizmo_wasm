#ifndef RASTER_H
#define RASTER_H

#include <stdint.h>
#include "texture.h"
#include "light3d.h"

#define RASTER_MAX_ATTRS 6

// A lighting mode only the rasterizer knows (after LIGHTING_PIXEL): per-pixel
// lighting of a triangle whose light is `base + sun * (lambert * shadow)`,
// which is all that directional lights need (see render_object).
#define LIGHTING_SUN 3

// Screen-space vertex ready for rasterization.
//   x, y: pixel coordinates (pixel centers at .5)
//   iw:   1 / view depth
//   u, v: texel coordinates premultiplied by iw (perspective correction)
//   a:    lighting attributes premultiplied by iw:
//         LIGHTING_VERTEX: light r, g, b
//         LIGHTING_PIXEL:  view-space position xyz, normal xyz
//         LIGHTING_SUN:    lambert, shadow map x, y, closeness
typedef struct
{
    float x, y, iw, u, v;
    float a[RASTER_MAX_ATTRS];
} svert_t;

typedef struct
{
    const texture_t *tex; // NULL: untextured, `color` is used
    uint32_t color;
    int lighting;   // LIGHTING_*
    int light[3];   // LIGHTING_TRIANGLE: light per channel (R, G, B), 0..256
                    // LIGHTING_SUN: the same for `base` (where the sun doesn't reach)
    int lit[3];     // LIGHTING_SUN, flat triangle: the same in full sun
    int sun_flat;   // LIGHTING_SUN: the lambert term is the same all over the triangle
    const lighting_t *lights;     // LIGHTING_PIXEL
    const unsigned char *active;  // LIGHTING_PIXEL: lights reaching the triangle
    int active_count;
    vec3_t base, sun;       // LIGHTING_SUN
    const shadow_t *shadow; // LIGHTING_SUN: orthographic map, NULL = no shadows
} raster_params_t;

// All rasterizers clip to the display bounds, so any input is memory-safe.
void raster_triangle(const svert_t *a, const svert_t *b, const svert_t *c, const raster_params_t *p);
void raster_line(float x0, float y0, float x1, float y1, uint32_t color);
// Same, but only where nothing closer was drawn (doesn't write depth), and
// faded: iw0, iw1 are 1 / view depth at each end (linear in screen space);
// opacity = iw * fade_scale + fade_offset, clamped to 0..1.
#define LINE_DEPTH_BIAS 1.002f
void raster_line_depth(float x0, float y0, float iw0, float x1, float y1, float iw1, uint32_t color,
                       float fade_scale, float fade_offset);

// Shadow maps: rasterizes a triangle given as (x, y, value) into a size x size
// float buffer, keeping the biggest value per texel. `value` must be linear
// in screen space. Marks the blocks it may touch in `cover` (see SHADOW_BLOCK).
void raster_depth(float *buf, unsigned char *cover, int size, const float *a, const float *b, const float *c);

// Light value (1.0 = full) to the 0..256 range color_modulate uses.
static inline int light_to_int(float l)
{
    if (!(l > 0.0f)) return 0;
    if (l >= 1.0f) return 256;
    return (int)(l * 256.0f);
}

// Multiplies each channel by r, g, b / 256 (memory order R, G, B, A), keeps alpha.
static inline uint32_t color_modulate(uint32_t c, int r, int g, int b)
{
    uint32_t cr = ((c & 0xFFu) * (uint32_t)r) >> 8;
    uint32_t cg = (((c >> 8) & 0xFFu) * (uint32_t)g) >> 8;
    uint32_t cb = (((c >> 16) & 0xFFu) * (uint32_t)b) >> 8;
    return (c & 0xFF000000u) | (cb << 16) | (cg << 8) | cr;
}

#endif
