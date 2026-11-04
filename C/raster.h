#ifndef RASTER_H
#define RASTER_H

#include <stdint.h>
#include "texture.h"

// Screen-space vertex ready for rasterization.
//   x, y: pixel coordinates (pixel centers at .5)
//   iw:   1 / view depth
//   u, v: texel coordinates premultiplied by iw (perspective correction)
typedef struct
{
    float x, y, iw, u, v;
} svert_t;

// All rasterizers clip to the display bounds, so any input is memory-safe.
void raster_flat(const svert_t *a, const svert_t *b, const svert_t *c, uint32_t color);
void raster_textured(const svert_t *a, const svert_t *b, const svert_t *c, const texture_t *tex, uint32_t shade);
void raster_line(float x0, float y0, float x1, float y1, uint32_t color);

// Scales RGB by shade/256, keeps alpha.
static inline uint32_t color_shade(uint32_t c, uint32_t shade)
{
    uint32_t rb = (((c & 0x00FF00FFu) * shade) >> 8) & 0x00FF00FFu;
    uint32_t g = (((c & 0x0000FF00u) * shade) >> 8) & 0x0000FF00u;
    return (c & 0xFF000000u) | rb | g;
}

#endif
