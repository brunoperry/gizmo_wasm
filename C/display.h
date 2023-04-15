#ifndef DISPLAY_H
#define DISPLAY_H

#include "object3d.h"
#include "gmath.h"
#include "walloc.h"

typedef struct
{
    int width;
    int height;
    vec3_t center;
    unsigned int *color_buffer;
    float *z_buffer;

    int length;

} display_t;

display_t *display_build(int width, int height);

void display_draw(display_t *display, object3d_t *obj3d, mat4_t view_matrix);
void display_clear(display_t *display, int color);
triangle_t *project_triangles(display_t *display, object3d_t *obj3d, mat4_t view_matrix);
void draw_line(display_t *display, int x0, int y0, int x1, int y1, int color);
void draw_pixel(display_t *display, int x, int y, int color);
int abgr_to_rgba(int color);

#endif