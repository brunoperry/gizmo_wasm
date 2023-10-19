#include "object.h"

inline object3d_t *obj3d_build(object3d_to_build_t *obj3d_to_build)
{
    object3d_t *obj3d = (object3d_t *)malloc(sizeof(object3d_t));

    int v_len = obj3d_to_build->v_buffer_len;

    obj3d->position = obj3d_to_build->p_buffer;
    obj3d->rotation = obj3d_to_build->r_buffer;
    obj3d->scale = obj3d_to_build->s_buffer;
    obj3d->texture.data = obj3d_to_build->t_buffer;
    obj3d->texture.width = obj3d_to_build->t_width;
    obj3d->texture.height = obj3d_to_build->t_height;

    obj3d->mesh.v_num = v_len / 3;
    obj3d->mesh.num_triangles = (v_len / 3) / 3;

    int v_counter = 0;
    for (int i = 0; i < v_len; i += 9)
    {
        obj3d->mesh.triangles[v_counter] = (triangle_t){
            .points = {
                (vec3_t){
                    .x = obj3d_to_build->v_buffer[i + 0],
                    .y = obj3d_to_build->v_buffer[i + 1],
                    .z = obj3d_to_build->v_buffer[i + 2]},
                (vec3_t){
                    .x = obj3d_to_build->v_buffer[i + 3],
                    .y = obj3d_to_build->v_buffer[i + 4],
                    .z = obj3d_to_build->v_buffer[i + 5]},
                (vec3_t){
                    .x = obj3d_to_build->v_buffer[i + 6],
                    .y = obj3d_to_build->v_buffer[i + 7],
                    .z = obj3d_to_build->v_buffer[i + 8]}},
            .normals = {(vec3_t){.x = obj3d_to_build->n_buffer[i + 0], .y = obj3d_to_build->n_buffer[i + 1], .z = obj3d_to_build->n_buffer[i + 2]}, (vec3_t){.x = obj3d_to_build->n_buffer[i + 3], .y = obj3d_to_build->n_buffer[i + 4], .z = obj3d_to_build->n_buffer[i + 5]}, (vec3_t){.x = obj3d_to_build->n_buffer[i + 6], .y = obj3d_to_build->n_buffer[i + 7], .z = obj3d_to_build->n_buffer[i + 8]}}};

        v_counter++;
    };

    int uv_len = obj3d_to_build->uv_buffer_len;
    v_counter = 0;
    for (int i = 0; i < uv_len; i += 6)
    {
        obj3d->mesh.triangles[v_counter].uvs[0] = (tex2_t){
            .u = obj3d_to_build->uv_buffer[i + 0],
            .v = obj3d_to_build->uv_buffer[i + 1],
        };
        obj3d->mesh.triangles[v_counter].uvs[1] = (tex2_t){
            .u = obj3d_to_build->uv_buffer[i + 2],
            .v = obj3d_to_build->uv_buffer[i + 3],
        };
        obj3d->mesh.triangles[v_counter].uvs[2] = (tex2_t){
            .u = obj3d_to_build->uv_buffer[i + 4],
            .v = obj3d_to_build->uv_buffer[i + 5],
        };
        v_counter++;
    };

    return obj3d;
}