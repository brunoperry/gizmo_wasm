#ifndef TRANSFORM_H
#define TRANSFORM_H

#include "walloc.h"

typedef struct
{
    float *position;
    float *rotation;
    float *scale;

} transform_t;

transform_t transform_build(unsigned int *obj_buffer);

#endif