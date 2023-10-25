#ifndef DISPLAY_H
#define DISPLAY_H

#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include "object.h"
#include "light3d.h"
#include "utils.h"

typedef struct
{
    int width;
    int half_width;
    int height;
    int half_height;
    uint32_t *color_buffer;
    unsigned int *texture_buffer;
    int texture_width;
    int texture_height;
    float *z_buffer;

    int bytes_length;
    unsigned int *render_mode;

} display_t;
static display_t display;

static texture_t *textures[10];
static int total_textures = 0;

typedef struct
{
    int width;
    int height;
    float center_x;
    float center_y;

} display_size_t;

uint32_t *display_create(int width, int height);
unsigned int *add_texture(int width, int height, int id);
void draw(object3d_t *obj3d);
void draw_wired_triangle(int x0, int y0, int x1, int y1, int x2, int y2, int color);
void draw_filled_triangle(int x0, int y0, float z0, float w0, int x1, int y1, float z1, float w1, int x2, int y2, float z2, float w2, int color);
void draw_textured_triangle(int x0, int y0, float z0, float w0, float u0, float v0, int x1, int y1, float z1, float w1, float u1, float v1, int x2, int y2, float z2, float w2, float u2, float v2, float light_intensity, texture_t *texture);
void draw_triangle_texel(int x, int y, vec4_t point_a, vec4_t point_b, vec4_t point_c, tex2_t a_uv, tex2_t b_uv, tex2_t c_uv, float intensity, texture_t *texture);
void draw_triangle_pixel(int x, int y, int color, vec4_t point_a, vec4_t point_b, vec4_t point_c);
void draw_pixel(int x, int y, uint32_t color);
void draw_line(int x0, int y0, int x1, int y1, int color);
void clear_color_buffer(int color);
void apply_fisheye(display_size_t display_size);
void apply_barrel_distortion(display_size_t display_size);
void clear_z_buffer(void);

unsigned int *set_render_mode();

#endif