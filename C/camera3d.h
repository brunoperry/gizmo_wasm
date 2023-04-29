#ifndef CAMERA3D_H
#define CAMERA3D_H

#include "gmath.h"
#include "walloc.h"
#include "clipping.h"

typedef struct
{
    int id;
    float *view_buffer;
    float *projection_buffer;
    float *position_buffer;
    clipping_t clipping;

} camera3d_t;

camera3d_t *camera_build(unsigned int *cam_buffer);

#endif