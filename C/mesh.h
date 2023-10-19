#ifndef MESH_H
#define MESH_H

#include "wasm.h"
#include "vector.h"
#include "texture.h"

#define MAX_TRIANGLES 10000

typedef struct
{
    vec3_t points[3];
    tex2_t uvs[3];
    vec3_t normals[3];

    vec4_t clipped_points[3];
    tex2_t clipped_uvs[3];

    vec4_t projected_points[3];
    tex2_t projected_uvs[3];
    vec4_t projected_normals[3];

    int color;
    float light_intensity;

} triangle_t;

typedef struct
{
    triangle_t triangles[MAX_TRIANGLES];
    int num_triangles;

    int v_num;
    int uv_num;
    int n_num;

    triangle_t triangles_to_render[MAX_TRIANGLES];
    int num_triangles_to_render;

} mesh_t;

#endif