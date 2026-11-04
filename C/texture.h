#ifndef TEXTURE_H
#define TEXTURE_H

#include <stdint.h>

#define MAX_TEXTURES 64

// RGBA8 pixels as written by canvas getImageData (0xAABBGGRR as uint32).
typedef struct
{
    int width;
    int height;
    int is_pot;  // both sides are powers of two -> wrap with masks
    int w_shift; // log2(width) when is_pot
    uint32_t *pixels;
} texture_t;

// Returns the new texture, or NULL if out of slots/memory.
texture_t *texture_create(int width, int height);
// Returns NULL for invalid ids.
texture_t *texture_get(int id);

#endif
