#include "polygon.h"

polygon_t polygon_from_triangle(triangle_t triangle)
{
    return (polygon_t){
        .vertices = {triangle.a, triangle.b, triangle.c},
        .num_vertices = 3};
}

void triangles_from_polygon(polygon_t polygon, triangle_strip_t *triangles)
{
    for (int i = 0; i < polygon.num_vertices - 2; i++)
    {
        int index0 = 0;
        int index1 = i + 1;
        int index2 = i + 2;

        triangles->tris[i].a = polygon.vertices[index0];
        triangles->tris[i].b = polygon.vertices[index1];
        triangles->tris[i].c = polygon.vertices[index2];
    }
    triangles->num_tris = polygon.num_vertices - 2;
}

void polygon_log(polygon_t poly)
{
    log_polygon(poly.num_vertices);
}