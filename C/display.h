#ifndef DISPLAY_H
#define DISPLAY_H

#define MAX_TRIANGLES 100000

#include "object3d.h"
#include "texture.h"
#include "gmath.h"
#include "walloc.h"
#include "polygon.h"
#include "clipping.h"
#include "camera3d.h"

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
void display_draw(display_t *display, object3d_t *obj3d, mat4_t mvp, camera3d_t camera);
// void display_draw(display_t *display, object3d_t *obj3d, mat4_t mvp, clipping_t clipping);
void display_clear(display_t *display, int color);
void project_triangles(display_t *display, object3d_t *obj3d, mat4_t mvp, camera3d_t camera);
// void project_triangles(display_t *display, clipping_t clipping, object3d_t *obj3d, mat4_t mvp);
void draw_line(display_t *display, int x0, int y0, int x1, int y1, int color);
void draw_pixel(display_t *display, int x, int y, int color);
void draw_textured_triangle(
    int x0, int y0, float z0, float w0, float u0, float v0,
    int x1, int y1, float z1, float w1, float u1, float v1,
    int x2, int y2, float z2, float w2, float u2, float v2,
    float light_intensity, texture_t texture);
void draw_triangle_texel(
    int x, int y,
    vec4_t point_a, vec4_t point_b, vec4_t point_c,
    tex2_t a_uv, tex2_t b_uv, tex2_t c_uv,
    float light_intensity, texture_t texture);
int abgr_to_rgba(int color);

#endif