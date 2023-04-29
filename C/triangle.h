#ifndef TRIANGLE_H
#define TRIANGLE_H

#include "gmath.h"
#include "wasm.h"

typedef struct
{
    triangle_t *tris;
    int num_tris;
} triangle_strip_t;

void triangle_log(triangle_t t);

#endif