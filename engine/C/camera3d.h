#ifndef CAMERA_H
#define CAMERA_H

#include "matrix.h"

// Camera parameters. Every field points to memory that javascript writes
// directly (see Camera3D.js), so changes are picked up on the next frame.
typedef struct
{
    float *aspect_x; // width / height
    float *aspect_y; // height / width
    float *fov_x;    // radians (unused: derived from fov_y + aspect)
    float *fov_y;    // radians
    float *z_near;
    float *z_far;
    float *position;  // vec3
    float *direction; // vec3, does not need to be normalized
    float *up;        // vec3
} camera_t;

// Everything the renderer needs for one frame, derived from camera_t.
//
// View space: x = right, y = up, z = forward (depth). The world is
// right-handed (y up, right = direction x up), matching Camera3D.js.
typedef struct
{
    mat4_t view;
    float proj_x; // x_ndc = x * proj_x / z
    float proj_y; // y_ndc = y * proj_y / z
    float z_near;
    float z_far;
} camera_frame_t;

extern camera_t camera3d;

void camera_frame(camera_frame_t *out);

#endif
