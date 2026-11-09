#ifndef DISPLAY_H
#define DISPLAY_H

#include <stdint.h>

enum
{
    RENDER_WIRED = 0,
    RENDER_SHADED = 1,
    RENDER_TEXTURED = 2,
};

enum
{
    FILTER_BARREL = 0,
    FILTER_FISHEYE = 1,
};

typedef struct
{
    int width;
    int height;
    uint32_t *color; // RGBA8, read by javascript as ImageData
    float *depth;    // 1/w per pixel: bigger is closer, 0 = empty

    // Post-processing filters: color is copied into `scratch`, then each pixel
    // is fetched through a precomputed source-index table (-1 = keep).
    uint32_t *scratch;
    uint32_t clear_color; // last display_clear() color
    int32_t *filter_maps[2];

    int32_t *render_mode; // written by javascript: [render mode, lighting mode, show light gizmos, shadows, show grid]

    // Scene environment (set_environment): the sky is the clear color, and
    // fog fades what's drawn into it between fog_near and fog_far (view
    // depth). Reset by scene_clear.
    int has_sky;
    uint32_t sky_color;
    float fog_near, fog_far; // fog_far <= fog_near: no fog
} display_t;

extern display_t display;

// Returns the color buffer, or NULL on failure.
uint32_t *display_create(int width, int height);
void display_clear(uint32_t color);
// Blends every pixel towards `color` by its depth: nothing before `near`,
// fully `color` from `far` on. Empty pixels (depth 0) are left as they are,
// so `color` must be the clear color.
void display_fog(uint32_t color, float near, float far);
void display_apply_filter(int filter);
// Drops the filter maps allocated after `mark` (see gz_release); they are
// rebuilt when needed.
void display_release(uintptr_t mark);

#endif
