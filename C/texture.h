#ifndef TEXTURE_H
#define TEXTURE_H

#include "wasm.h"

typedef struct
{
    int width;
    int height;
    unsigned int *data;
    float light_intensity;

} texture_t;

#endif