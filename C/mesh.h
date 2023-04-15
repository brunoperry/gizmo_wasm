#ifndef MESH_H
#define MESH_H

#include "triangle.h"
#include "walloc.h"

typedef struct
{
    float *vertices;
    float *uvs;
    float *normals;
    triangle_t *triangles;
    int num_triangles;

    int v_length;
    int uv_length;
    int n_length;

} mesh_t;

mesh_t mesh_build(unsigned int *obj_buffer, int *lengths);
void mesh_initialize(mesh_t mesh);

#endif