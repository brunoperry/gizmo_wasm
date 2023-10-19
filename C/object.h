#ifndef OBJECT3D_H
#define OBJECT3D_H

#include "stdlib.h"
#include "texture.h"
#include "mesh.h"

typedef struct
{
    float *v_buffer;
    float *uv_buffer;
    float *n_buffer;

    int v_buffer_len;
    int uv_buffer_len;
    int n_buffer_len;

    float *p_buffer;
    float *r_buffer;
    float *s_buffer;

    unsigned int *t_buffer;
    int t_width;
    int t_height;

} object3d_to_build_t;

typedef struct
{
    float *position;
    float *rotation;
    float *scale;

    texture_t texture;
    mesh_t mesh;

} object3d_t;

object3d_t *obj3d_build(object3d_to_build_t *obj3d_to_build);

#endif