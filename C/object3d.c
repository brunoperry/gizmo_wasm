#include "object3d.h"
#include "walloc.h"

#include "wasm.h"

object3d_t *obj3d_build(unsigned int *obj_buffer, int *lengths)
{
    object3d_t *obj3d = malloc(sizeof(object3d_t));

    obj3d->mesh = mesh_build(obj_buffer, lengths);

    obj_buffer[4] = (unsigned int)malloc(16 * sizeof(float));
    obj3d->model_buffer = (float *)obj_buffer[6];

    return obj3d;
}

void obj3d_initialize(object3d_t *obj3d)
{
    mesh_initialize(obj3d->mesh);
}
