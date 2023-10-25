#ifndef TEXTURE_H
#define TEXTURE_H

#include "vector.h"
#include "mesh.h"
#include "light3d.h"
#include "wasm.h"

typedef struct
{
    int width;
    int height;
    unsigned int *texture_buffer;
    float light_intensity;

} texture_t;

typedef struct
{
    int width;
    int height;
    double *depth_buffer;
    unsigned int *frame_buffer;
} rendertarget_t;

double get_depth(vec3_t point, vec3_t light_position, vec3_t light_direction);

#endif