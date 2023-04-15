#include "camera3d.h"

camera3d_t *camera_build(unsigned int *cam_buffer)
{
    camera3d_t *cam3d = malloc(sizeof(camera3d_t));

    cam_buffer[0] = (unsigned int)malloc(16 * sizeof(float));
    cam_buffer[1] = (unsigned int)malloc(16 * sizeof(float));

    cam3d->view_buffer = (float *)cam_buffer[0];
    cam3d->projection_buffer = (float *)cam_buffer[1];

    return cam3d;
};
