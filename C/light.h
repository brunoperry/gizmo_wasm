#ifndef LIGHT_H
#define LIGHT_H

#include "gmath.h"
#include "walloc.h"

typedef struct
{
    float *direction;
    int color;
    float ambient;
} light_t;

static light_t *light;

light_t *light_build(light_t *light_to_build);

#endif