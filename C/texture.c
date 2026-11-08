#include "texture.h"
#include "memory.h"

static texture_t *textures[MAX_TEXTURES];
static int total_textures = 0;

static int is_pow2(int v) { return v > 0 && (v & (v - 1)) == 0; }

texture_t *texture_create(int width, int height)
{
    if (total_textures >= MAX_TEXTURES || width <= 0 || height <= 0)
        return NULL;

    texture_t *t = gz_alloc(sizeof(texture_t));
    uint32_t *pixels = gz_alloc((size_t)width * height * sizeof(uint32_t));
    if (!t || !pixels)
        return NULL;

    t->width = width;
    t->height = height;
    t->pixels = pixels;
    t->is_pot = is_pow2(width) && is_pow2(height);
    t->w_shift = __builtin_ctz((unsigned)width);

    textures[total_textures++] = t;
    return t;
}

int texture_count(void) { return total_textures; }

// Textures are created in order, so the released ones are the last ones.
void textures_release(uintptr_t mark)
{
    while (total_textures > 0 && gz_after(textures[total_textures - 1], mark))
        textures[--total_textures] = NULL;
}

texture_t *texture_get(int id)
{
    if (id < 0 || id >= total_textures)
        return NULL;
    return textures[id];
}
