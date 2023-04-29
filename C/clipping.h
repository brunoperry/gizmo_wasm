#ifndef CLIPPING_H
#define CLIPPING_H

#define NUM_PLANES 6

#include "gmath.h"
#include "wasm.h"
#include "polygon.h"

enum
{
    LEFT_FRUSTUM_PLANE,
    RIGHT_FRUSTUM_PLANE,
    TOP_FRUSTUM_PLANE,
    BOTTOM_FRUSTUM_PLANE,
    NEAR_FRUSTUM_PLANE,
    FAR_FRUSTUM_PLANE
};

typedef struct
{
    vec3_t point;
    vec3_t normal;
} plane_t;

typedef struct
{
    plane_t frustum_planes[NUM_PLANES];
} clipping_t;

clipping_t init_frustum_planes();
void clip_polygon_against_plane(polygon_t *polygon, plane_t plane);
void clip_polygon(clipping_t clipping, polygon_t *polygon);

#endif