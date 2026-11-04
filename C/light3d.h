#ifndef LIGHT_H
#define LIGHT_H

// Directional light. `direction` points to a vec3 written by javascript
// (see Light3D.js); it does not need to be normalized.
typedef struct
{
    float *direction;
} light_t;

extern light_t light3d;

#endif
