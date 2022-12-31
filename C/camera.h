#ifndef CAMERA_H
#define CAMERA_H

#include "mesh.h"
#include "gmath.h"
#include "walloc.h"

#define NUM_PLANES 6

#define MAX_NUM_POLY_VERTICES 10
#define MAX_NUM_POLY_TRIANGLES 10

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
    vec3_t vertices[MAX_NUM_POLY_VERTICES];
    tex2_t texcoords[MAX_NUM_POLY_VERTICES];
    int num_vertices;
} polygon_t;

typedef struct
{
    float *aspect_x;
    float *aspect_y;
    float *fov_x;
    float *fov_y;

    float *z_near;
    float *z_far;

    float *position;
    float *direction;
    float *up;

    mat4_t proj_matrix;
    plane_t frustum_planes[NUM_PLANES];

} camera_t;
static camera_t *camera;

camera_t *camera_build(camera_t *cam_to_build);
mat4_t cam_look_at(camera_t *camera, vec3_t target);
mat4_t cam_view(camera_t *camera);
void init_frustum_planes();
polygon_t polygon_from_triangle(vec3_t v0, vec3_t v1, vec3_t v2, triangle_t triangle);
void triangles_from_polygon(polygon_t *polygon, triangle_t triangles[], int *num_triangles);
void clip_polygon(polygon_t *polygon);

#endif