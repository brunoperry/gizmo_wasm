#ifndef OBJECT3D_H
#define OBJECT3D_H

#define MAX_OBJECTS 256

// Triangle soup written by javascript (see Object3D.js):
//   vertices: 9 floats per triangle (x,y,z * 3)
//   uvs:      6 floats per triangle (u,v * 3)
// position/rotation/scale are vec3s javascript updates every frame
// (rotation in radians).
typedef struct
{
    float *vertices;
    float *uvs;
    float *normals; // uploaded by JS, unused for flat shading
    int num_triangles;

    float *position;
    float *rotation;
    float *scale;

    int texture_id;
} object3d_t;

#endif
