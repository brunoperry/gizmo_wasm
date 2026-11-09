#include <math.h>
#include <string.h>
#include "display.h"
#include "memory.h"

display_t display;

uint32_t *display_create(int width, int height)
{
    size_t length = (size_t)width * height;
    uint32_t *color = gz_alloc(length * sizeof(uint32_t));
    float *depth = gz_alloc(length * sizeof(float));
    uint32_t *scratch = gz_alloc(length * sizeof(uint32_t));
    if (!color || !depth || !scratch)
        return NULL;

    display.width = width;
    display.height = height;
    display.color = color;
    display.depth = depth;
    display.scratch = scratch;
    display.filter_maps[FILTER_BARREL] = NULL;
    display.filter_maps[FILTER_FISHEYE] = NULL;
    return color;
}

void display_clear(uint32_t color)
{
    size_t length = (size_t)display.width * display.height;
    uint32_t *c = display.color;
    display.clear_color = color;
    for (size_t i = 0; i < length; i++) // auto-vectorized (simd128)
        c[i] = color;
    memset(display.depth, 0, length * sizeof(float)); // 0.0f == "infinitely far"
}

// Barrel distortion strength (0 = none).
#define BARREL_K 0.25f

// Source pixel for (x, y), or -1 to leave the pixel untouched.
//
// Barrel: a pixel at normalized radius r (1 = corner) samples the image at
// r * (1 + k r^2) / (1 + k). The division keeps the corners in place, so the
// whole screen stays covered: the centre is magnified and straight lines
// bow outwards.
static int32_t barrel_source(int x, int y, int w, int h)
{
    float cx = 0.5f * (float)w, cy = 0.5f * (float)h;
    float dx = (float)x + 0.5f - cx, dy = (float)y + 0.5f - cy;
    float r2 = (dx * dx + dy * dy) / (cx * cx + cy * cy);
    float scale = (1.0f + BARREL_K * r2) / (1.0f + BARREL_K);
    int sx = (int)floorf(cx + dx * scale);
    int sy = (int)floorf(cy + dy * scale);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h)
        return -1;
    return sy * w + sx;
}

static int32_t fisheye_source(int x, int y, int w, int h)
{
    int cx = w / 2, cy = h / 2;
    float threshold = 0.5f * sqrtf((float)w * w + (float)h * h);
    float dx = (float)(x - cx), dy = (float)(y - cy);
    float distance = sqrtf(dx * dx + dy * dy);
    if (distance > threshold)
        return -1;
    float factor = 0.63661977f /* 2 / pi */ * asinf(distance / threshold);
    int sx = (int)(cx + factor * dx);
    int sy = (int)(cy + factor * dy);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h)
        return -1;
    return sy * w + sx;
}

void display_apply_filter(int filter)
{
    if (filter != FILTER_BARREL && filter != FILTER_FISHEYE)
        return;

    int w = display.width, h = display.height;
    size_t length = (size_t)w * h;

    int32_t *map = display.filter_maps[filter];
    if (!map)
    {
        map = gz_alloc(length * sizeof(int32_t));
        if (!map)
            return;
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                map[y * w + x] = filter == FILTER_BARREL ? barrel_source(x, y, w, h)
                                                         : fisheye_source(x, y, w, h);
        display.filter_maps[filter] = map;
    }

    // Read from an untouched copy so already-distorted pixels aren't resampled.
    memcpy(display.scratch, display.color, length * sizeof(uint32_t));
    for (size_t i = 0; i < length; i++)
        if (map[i] >= 0)
            display.color[i] = display.scratch[map[i]];
}

void display_release(uintptr_t mark)
{
    for (int i = 0; i < 2; i++)
        if (gz_after(display.filter_maps[i], mark))
            display.filter_maps[i] = NULL;
}
