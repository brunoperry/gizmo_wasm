#include "display.h"

#include "wasm.h"

display_t *display_build(int width, int height)
{
    display_t *display = malloc(sizeof(display_t));

    int length = width * height;

    display->width = width;
    display->height = height;
    display->color_buffer = (unsigned int *)malloc(length * sizeof(float));
    display->z_buffer = (float *)malloc(length * sizeof(float));
    display->length = length;
    display->center = vec3_new(width / 2, height / 2, 0);

    return display;
}

void display_draw(display_t *display, object3d_t *obj3d, mat4_t mvp)
{
    triangle_t *triangles = project_triangles(display, obj3d, mvp);
    int color = 0xffffffff;

    for (int i = 0; i < obj3d->mesh.num_triangles; i++)
    {
        triangle_t tri = triangles[i];
        draw_pixel(display, tri.a.x, tri.a.y, color);
        draw_pixel(display, tri.b.x, tri.b.y, color);
        draw_pixel(display, tri.c.x, tri.c.y, color);
    }

    free(triangles);
}

triangle_t *project_triangles(display_t *display, object3d_t *obj3d, mat4_t mvp)
{
    int num_tris = obj3d->mesh.num_triangles;
    triangle_t *triangles_out = malloc(num_tris * sizeof(triangle_t));
    triangle_t *triangles_in = obj3d->mesh.triangles;

    for (int i = 0; i < num_tris; i++)
    {
        triangle_log(triangles_in[i]);
        // Apply the view-projection matrix to each vertex of the triangle
        vec4_t a = mat4_mul_vec4(mvp, vec4_from_vec3(triangles_in[i].a));
        vec4_t b = mat4_mul_vec4(mvp, vec4_from_vec3(triangles_in[i].b));
        vec4_t c = mat4_mul_vec4(mvp, vec4_from_vec3(triangles_in[i].c));

        // Divide by w to get the projected coordinates, center to screen and store the projected triangle
        triangles_out[i].a = vec3_add_vecs(vec4_divide_scalar_2d(a, a.w), display->center);
        triangles_out[i].b = vec3_add_vecs(vec4_divide_scalar_2d(b, b.w), display->center);
        triangles_out[i].c = vec3_add_vecs(vec4_divide_scalar_2d(c, c.w), display->center);
    }

    return triangles_out;
}

void draw_line(display_t *display, int x0, int y0, int x1, int y1, int color)
{
    int delta_x = (x1 - x0);
    int delta_y = (y1 - y0);

    int longest_side_length = (abs(delta_x) >= abs(delta_y)) ? abs(delta_x) : abs(delta_y);

    float x_inc = delta_x / (float)longest_side_length;
    float y_inc = delta_y / (float)longest_side_length;

    float current_x = x0;
    float current_y = y0;

    // console_log(1, longest_side_length);

    // for (int i = 0; i <= longest_side_length; i++)
    // {
    //     draw_pixel(display, (int)current_x, (int)current_y, color);
    //     current_x += x_inc;
    //     current_y += y_inc;
    // }
}

void draw_pixel(display_t *display, int x, int y, int color)
{
    if (x >= 0 && x < display->width && y >= 0 && y < display->height)
    {
        display->color_buffer[(display->width * y) + x] = color;
    }
}

void display_clear(display_t *display, int color)
{
    int final_color = abgr_to_rgba(color);
    for (size_t i = 0; i < display->length; i++)
    {
        display->color_buffer[i] = final_color;
        display->z_buffer[i] = 1.0f;
    }
}

int abgr_to_rgba(int color)
{
    int a = (color >> 24) & 0xff;
    int b = (color >> 16) & 0xff;
    int g = (color >> 8) & 0xff;
    int r = color & 0xff;
    int rgba_color = (r << 24) | (g << 16) | (b << 8) | a;
    return rgba_color;
}