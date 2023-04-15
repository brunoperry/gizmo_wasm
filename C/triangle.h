#ifndef TRIANGLE_H
#define TRIANGLE_H

#include "gmath.h"
#include "wasm.h"

typedef struct
{
    vec3_t a;
    vec3_t b;
    vec3_t c;
    int color;

} triangle_t;

void triangle_log(triangle_t t);

#endif