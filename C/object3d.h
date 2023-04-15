#ifndef OBJECT3D_H
#define OBJECT3D_H

#include "gmath.h"
#include "mesh.h"

typedef struct
{
    mesh_t mesh;
    float *model_buffer;

} object3d_t;

object3d_t *obj3d_build(unsigned int *obj_buffer, int *lengths);
void obj3d_initialize(object3d_t *obj3d);

#endif