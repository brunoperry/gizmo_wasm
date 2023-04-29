#include "display.h"
#include "wasm.h"

static triangle_t *projected_triangles;
static int num_triangles;

display_t *display_build(int width, int height)
{
    display_t *display = malloc(sizeof(display_t));
    projected_triangles = malloc(MAX_TRIANGLES * sizeof(triangle_t));

    int length = width * height;

    display->width = width;
    display->height = height;
    display->color_buffer = (unsigned int *)malloc(length * sizeof(float));
    display->z_buffer = (float *)malloc(length * sizeof(float));
    display->length = length;
    display->center = vec3_new(width / 2, height / 2, 0);

    return display;
}
// void display_draw(display_t *display, object3d_t *obj3d, mat4_t mvp, clipping_t clipping)
void display_draw(display_t *display, object3d_t *obj3d, mat4_t mvp, camera3d_t camera)
{
    project_triangles(display, obj3d, mvp, camera);

    int color = 0xffffffff;
    for (int i = 0; i < num_triangles; i++)
    {
        triangle_t tri = projected_triangles[i];
        draw_line(display, tri.a.x, tri.a.y, tri.b.x, tri.b.y, color);
        draw_line(display, tri.b.x, tri.b.y, tri.c.x, tri.c.y, color);
        draw_line(display, tri.c.x, tri.c.y, tri.a.x, tri.a.y, color);
    }
}

// void project_triangles(display_t *display, clipping_t clipping, object3d_t *obj3d, mat4_t mvp)
void project_triangles(display_t *display, object3d_t *obj3d, mat4_t mvp, camera3d_t camera)
{
    int num_projected_tris = 0;
    triangle_t *triangles_in = obj3d->mesh.triangles;
    // triangle_t tris_to_clip[obj3d->mesh.num_triangles];
    triangle_t *tris_to_clip = malloc(obj3d->mesh.num_triangles * sizeof(triangle_t));
    // Project the triangles
    for (int i = 0; i < obj3d->mesh.num_triangles; i++)
    {
        // Apply transform and the view-projection matrix to each vertex of the triangle
        vec4_t a = mat4_project_vec4(mvp, mat4_mul_vec4(mvp, triangles_in[i].a));
        vec4_t b = mat4_project_vec4(mvp, mat4_mul_vec4(mvp, triangles_in[i].b));
        vec4_t c = mat4_project_vec4(mvp, mat4_mul_vec4(mvp, triangles_in[i].c));

        // Get the vector subtraction of B-A and C-A
        vec3_t vector_ab = vec4_to_vec3(vec4_sub_vecs(b, a));
        vec3_t vector_ac = vec4_to_vec3(vec4_sub_vecs(c, a));
        vec3_normalize(&vector_ab);
        vec3_normalize(&vector_ac);

        // Compute the face normal (using cross product to find perpendicular)
        vec3_t normal = vec3_cross(vector_ab, vector_ac);
        vec3_normalize(&normal);

        // Find the vector between vertex A in the triangle and the camera origin
        vec3_t origin = {0, 0, -2};
        vec3_t camera_ray = vec3_sub_vecs(origin, (vec3_t){a.x, a.y, a.z});

        // Calculate how aligned the camera ray is with the face normal (using dot product).
        // Backface culling, bypassing triangles that are looking away from the camera
        if (vec3_dot(normal, camera_ray) < 0)
            continue;
        tris_to_clip[num_projected_tris] = (triangle_t){a, b, c};
        num_projected_tris++;
    }

    // Now we have the total triangles to render after backface culling, lets clip them
    num_triangles = 0;
    for (size_t i = 0; i < num_projected_tris; i++)
    {
        // Convert the triangle into a polygon
        polygon_t polygon = polygon_from_triangle(tris_to_clip[i]);

        // Clip the polygon
        clip_polygon(camera.clipping, &polygon);

        // Convert the polygon back into triangles
        triangle_strip_t clip_result;
        clip_result.tris = malloc(MAX_NUM_POLY_TRIANGLES * sizeof(triangle_t));
        triangles_from_polygon(polygon, &clip_result);
        for (size_t j = 0; j < clip_result.num_tris; j++)
        {
            projected_triangles[num_triangles + j] = clip_result.tris[j];
        }
        num_triangles += clip_result.num_tris;
        free(clip_result.tris);
    }
    free(tris_to_clip);
}

void draw_line(display_t *display, int x0, int y0, int x1, int y1, int color)
{
    int dx = abs(x1 - x0);
    int dy = abs(y1 - y0);
    int sx = (x0 < x1) ? 1 : -1;
    int sy = (y0 < y1) ? 1 : -1;
    int err = dx - dy;

    while (1)
    {
        draw_pixel(display, x0, y0, color);
        if (x0 == x1 && y0 == y1)
        {
            break;
        }
        int e2 = 2 * err;
        if (e2 > -dy)
        {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx)
        {
            err += dx;
            y0 += sy;
        }
    }
}

void draw_pixel(display_t *display, int x, int y, int color)
{
    if (x >= 0 && x < display->width && y >= 0 && y < display->height)
    {
        display->color_buffer[(display->width * y) + x] = color;
    }
}

void draw_textured_triangle(
    int x0, int y0, float z0, float w0, float u0, float v0,
    int x1, int y1, float z1, float w1, float u1, float v1,
    int x2, int y2, float z2, float w2, float u2, float v2,
    float light_intensity, texture_t texture)
{

    // We need to sort the vertices by y-coordinate ascending (y0 < y1 < y2)
    if (y0 > y1)
    {
        int_swap(&y0, &y1);
        int_swap(&x0, &x1);
        float_swap(&z0, &z1);
        float_swap(&w0, &w1);
        float_swap(&u0, &u1);
        float_swap(&v0, &v1);
    }
    if (y1 > y2)
    {
        int_swap(&y1, &y2);
        int_swap(&x1, &x2);
        float_swap(&z1, &z2);
        float_swap(&w1, &w2);
        float_swap(&u1, &u2);
        float_swap(&v1, &v2);
    }
    if (y0 > y1)
    {
        int_swap(&y0, &y1);
        int_swap(&x0, &x1);
        float_swap(&z0, &z1);
        float_swap(&w0, &w1);
        float_swap(&u0, &u1);
        float_swap(&v0, &v1);
    }

    // Flip the V component to account for inverted UV-coordinates (V grows downwards)
    v0 = 1.0 - v0;
    v1 = 1.0 - v1;
    v2 = 1.0 - v2;

    // Create vector points and texture coords after we sort the vertices
    vec4_t point_a = {x0, y0, z0, w0};
    vec4_t point_b = {x1, y1, z1, w1};
    vec4_t point_c = {x2, y2, z2, w2};
    tex2_t a_uv = {u0, v0};
    tex2_t b_uv = {u1, v1};
    tex2_t c_uv = {u2, v2};

    ///////////////////////////////////////////////////////
    // Render the upper part of the triangle (flat-bottom)
    ///////////////////////////////////////////////////////
    float inv_slope_1 = 0;
    float inv_slope_2 = 0;

    if (y1 - y0 != 0)
        inv_slope_1 = (float)(x1 - x0) / abs(y1 - y0);
    if (y2 - y0 != 0)
        inv_slope_2 = (float)(x2 - x0) / abs(y2 - y0);

    if (y1 - y0 != 0)
    {
        float x_start_f = x1 + (y0 - y1) * inv_slope_1;
        float x_end_f = x0 + (y0 - y1) * inv_slope_2;

        int x_start = (int)round(x_start_f);
        int x_end = (int)round(x_end_f);

        if (x_end < x_start)
        {
            int_swap(&x_start, &x_end);
        }

        for (int y = y0; y <= y1; y++)
        {
            for (int x = x_start; x < x_end; x++)
            {
                // draw_triangle_texel(x, y, point_a, point_b, point_c, a_uv, b_uv, c_uv, light_intensity, texture);
            }
            x_start += inv_slope_1;
            x_end += inv_slope_2;
        }
    }
    ///////////////////////////////////////////////////////
    // Render the bottom part of the triangle (flat-top)
    ///////////////////////////////////////////////////////
    inv_slope_1 = 0;
    inv_slope_2 = 0;

    if (y1 - y0 != 0)
    {
        inv_slope_1 = (float)(x1 - x0) / abs(y1 - y0);
        if (y2 - y1 != 0)
            inv_slope_2 = (float)(x2 - x1) / abs(y2 - y1);

        for (int y = y1; y <= y2; y++)
        {
            int x_start, x_end;

            if (y < y2)
            {
                x_start = x1 + (y - y1) * inv_slope_1;
                x_end = x0 + (y - y0) * inv_slope_2;
            }
            else // special case when y == y2
            {
                x_start = x2;
                x_end = x0 + (y - y0) * inv_slope_1;
            }

            if (x_end < x_start)
            {
                int_swap(&x_start, &x_end);
            }

            for (int x = x_start; x < x_end; x++)
            {
                // draw_triangle_texel(x, y, point_a, point_b, point_c, a_uv, b_uv, c_uv, light_intensity, texture);
            }
        }
    }
}

void draw_triangle_texel(
    int x, int y,
    vec4_t point_a, vec4_t point_b, vec4_t point_c,
    tex2_t a_uv, tex2_t b_uv, tex2_t c_uv,
    float light_intensity, texture_t texture)
{
    vec2_t p = {x, y};
    vec2_t a = vec2_from_vec4(point_a);
    vec2_t b = vec2_from_vec4(point_b);
    vec2_t c = vec2_from_vec4(point_c);

    // Calculate the barycentric coordinates of our point 'p' inside the triangle
    vec3_t weights = barycentric_weights(a, b, c, p);

    float alpha = weights.x;
    float beta = weights.y;
    float gamma = weights.z;

    // Variables to store the interpolated values of U, V, and also 1/w for the current pixel
    float interpolated_u;
    float interpolated_v;
    float interpolated_reciprocal_w;

    // Perform the interpolation of all U/w and V/w values using barycentric weights and a factor of 1/w
    interpolated_u = (a_uv.u / point_a.w) * alpha + (b_uv.u / point_b.w) * beta + (c_uv.u / point_c.w) * gamma;
    interpolated_v = (a_uv.v / point_a.w) * alpha + (b_uv.v / point_b.w) * beta + (c_uv.v / point_c.w) * gamma;

    // Also interpolate the value of 1/w for the current pixel
    interpolated_reciprocal_w = (1 / point_a.w) * alpha + (1 / point_b.w) * beta + (1 / point_c.w) * gamma;

    // Now we can divide back both interpolated values by 1/w
    interpolated_u /= interpolated_reciprocal_w;
    interpolated_v /= interpolated_reciprocal_w;

    // Map the UV coordinate to the full texture width and height
    int tex_x = abs((int)(interpolated_u * texture.width)) % texture.width;
    int tex_y = abs((int)(interpolated_v * texture.height)) % texture.height;

    // Adjust 1/w so the pixels that are closer to the camera have smaller values
    interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;

    // Only draw the pixel if the depth value is less than the one previously stored in the z-buffer
    // if (interpolated_reciprocal_w < display.z_buffer[(display.width * y) + x])
    // {
    //     int color = light_apply_intensity(texture.data[(texture.width * tex_y) + tex_x], light_intensity);

    //     // Draw a pixel at position (x,y) with the color that comes from the mapped texture
    //     draw_pixel(display, x, y, color);

    //     // Update the z-buffer value with the 1/w of this current pixel
    //     display.z_buffer[(display.width * y) + x] = interpolated_reciprocal_w;
    // }
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