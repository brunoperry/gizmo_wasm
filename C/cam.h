#ifndef CAM_H
#define CAM_H

#include "walloc.h"

typedef struct
{
    float *position; // Position of the camera
    float *front;    // Front vector of the camera
    float *right;    // Right vector of the camera
    float *up;       // Up vector of the camera

    float pitch; // Pitch angle of the camera
    float yaw;   // Yaw angle of the camera
    float roll;  // Roll angle of the camera

} cam_t;
static cam_t *cam;

cam_t *cam_build(unsigned int *cam_buffer);

#endif