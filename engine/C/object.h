#ifndef OBJECT3D_H
#define OBJECT3D_H

#include <stdint.h>

#define MAX_OBJECTS 256

struct skin_s;

// Triangle soup written by javascript (see Object3D.js):
//   vertices: 9 floats per triangle (x,y,z * 3)
//   uvs:      6 floats per triangle (u,v * 3)
// position/rotation/scale are vec3s javascript updates every frame
// (rotation in radians).
typedef struct
{
    float *vertices;
    float *uvs;
    float *normals; // 9 floats per triangle; zeros where the model has none
    int has_normals;
    int num_triangles;

    float *position;
    float *rotation;
    float *scale;

    int texture_id;

    float bounds_min[3], bounds_max[3]; // local-space box, for fitting shadow maps

    struct skin_s *skin;     // skeletal animation, NULL for rigid objects
    uint32_t deform_version; // bumped whenever skinning moves the vertices
} object3d_t;

#endif
