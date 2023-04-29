#ifndef POLYGON_H
#define POLYGON_H

#include "gmath.h"
#include "triangle.h"

#define MAX_NUM_POLY_VERTICES 10
#define MAX_NUM_POLY_TRIANGLES 10

typedef struct
{
    vec4_t vertices[MAX_NUM_POLY_VERTICES];
    tex2_t texcoords[MAX_NUM_POLY_VERTICES];
    int num_vertices;
} polygon_t;

void triangles_from_polygon(polygon_t polygon, triangle_strip_t *triangles);
polygon_t polygon_from_triangle(triangle_t triangle);
void polygon_log(polygon_t poly);

#endif