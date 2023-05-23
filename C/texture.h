#ifndef TEXTURE_H
#define TEXTURE_H

#include "gmath.h"
#include "mesh.h"
#include "light3d.h"
#include "wasm.h"

typedef struct
{
    int width;
    int height;
    unsigned int *data;
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
// void render_shadow_map(rendertarget_t *shadow_map, triangle_t *triangles, int triangle_count, light_t light);

#endif