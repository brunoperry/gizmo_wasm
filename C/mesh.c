#include "mesh.h"

mesh_t mesh_build(unsigned int *obj_buffer, int *lengths)
{
    mesh_t mesh;

    obj_buffer[0] = (unsigned int)malloc(lengths[0] * sizeof(float));          // vertives
    obj_buffer[1] = (unsigned int)malloc(lengths[1] * sizeof(float));          // uvs
    obj_buffer[2] = (unsigned int)malloc(lengths[2] * sizeof(float));          // normals
    obj_buffer[3] = (unsigned int)malloc(lengths[0] / 9 * sizeof(triangle_t)); // triangles

    mesh.vertices = (float *)obj_buffer[0];
    mesh.uvs = (float *)obj_buffer[1];
    mesh.normals = (float *)obj_buffer[2];
    mesh.triangles = (triangle_t *)obj_buffer[3];

    mesh.v_length = lengths[0];
    mesh.uv_length = lengths[1];
    mesh.n_length = lengths[2];
    mesh.num_triangles = lengths[0] / 9;

    return mesh;
}

void mesh_initialize(mesh_t mesh)
{
    int curr_tri = 0;
    float *verts = mesh.vertices;

    for (size_t i = 0; i < mesh.v_length; i += 9)
    {
        triangle_t tri;
        tri.a = vec3_new(verts[i + 0], verts[i + 1], verts[i + 2]);
        tri.b = vec3_new(verts[i + 3], verts[i + 4], verts[i + 5]);
        tri.c = vec3_new(verts[i + 6], verts[i + 7], verts[i + 8]);
        mesh.triangles[curr_tri] = tri;

        curr_tri++;
    }
}

void mesh_log(mesh_t)
{
}