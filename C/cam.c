#include "cam.h"

cam_t *cam_build(unsigned int *cam_buffer)
{
    cam_t *c = (cam_t *)malloc(sizeof(cam_t));
    c->position = (float *)cam_buffer[0];
    c->front = (float *)cam_buffer[1];
    c->right = (float *)cam_buffer[2];
    c->up = (float *)cam_buffer[3];

    c->pitch = (float)cam_buffer[4];
    c->yaw = (float)cam_buffer[5];
    c->roll = (float)cam_buffer[6];

    return c;
}