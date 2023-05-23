#ifndef LIGHT_H
#define LIGHT_H

#include "gmath.h"
#include "walloc.h"
#include "wasm.h"

typedef struct
{
    float *direction;
    int color;
} light_t;

static light_t *light3d;

light_t *light_build(light_t *light_to_build);
int light_apply_intensity(int original_color, float percentage_factor);
int light_apply_ambient(light_t light, int color);

#endif