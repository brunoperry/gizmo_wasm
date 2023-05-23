#include "display.h"
#include <stdint.h>

unsigned int *display_create(int width, int height)
{
    int length = width * height;
    unsigned int *color_buffer = malloc(length * sizeof(int));
    float *z_buffer = (float *)malloc(length * sizeof(float));

    display.width = width;
    display.half_width = width / 2;
    display.height = height;
    display.half_height = height / 2;

    display.color_buffer = color_buffer;
    display.z_buffer = z_buffer;
    display.bytes_length = width * height;

    return color_buffer;
}

void draw(object3d_t *obj3d)
{
    if (display.render_mode[0] == 0)
    {
        for (int i = 0; i < obj3d->mesh.num_triangles_to_render; i++)
        {
            triangle_t triangle = obj3d->mesh.triangles_to_render[i];
            draw_wired_triangle(
                triangle.projected_points[0].x, triangle.projected_points[0].y, // vertex A
                triangle.projected_points[1].x, triangle.projected_points[1].y, // vertex B
                triangle.projected_points[2].x, triangle.projected_points[2].y, // vertex C
                0xff640000);
        }
    }
    else if (display.render_mode[0] == 1)
    {

        for (int i = 0; i < obj3d->mesh.num_triangles_to_render; i++)
        {
            triangle_t triangle = obj3d->mesh.triangles_to_render[i];
            draw_filled_triangle(
                triangle.projected_points[0].x, triangle.projected_points[0].y, triangle.projected_points[0].z, triangle.projected_points[0].w, // vertex A
                triangle.projected_points[1].x, triangle.projected_points[1].y, triangle.projected_points[1].z, triangle.projected_points[1].w, // vertex B
                triangle.projected_points[2].x, triangle.projected_points[2].y, triangle.projected_points[2].z, triangle.projected_points[2].w, // vertex C
                triangle.color);
        }
    }
    else
    {
        for (int i = 0; i < obj3d->mesh.num_triangles_to_render; i++)
        {
            triangle_t triangle = obj3d->mesh.triangles_to_render[i];
            draw_textured_triangle(
                triangle.projected_points[0].x, triangle.projected_points[0].y, triangle.projected_points[0].z, triangle.projected_points[0].w, triangle.projected_uvs[0].u, triangle.projected_uvs[0].v, // vertex A
                triangle.projected_points[1].x, triangle.projected_points[1].y, triangle.projected_points[1].z, triangle.projected_points[1].w, triangle.projected_uvs[1].u, triangle.projected_uvs[1].v, // vertex B
                triangle.projected_points[2].x, triangle.projected_points[2].y, triangle.projected_points[2].z, triangle.projected_points[2].w, triangle.projected_uvs[2].u, triangle.projected_uvs[2].v, // vertex C
                triangle.light_intensity, obj3d->texture);
        }
    }
}

void draw_wired_triangle(int x0, int y0, int x1, int y1, int x2, int y2, int color)
{
    draw_line(x0, y0, x1, y1, color);
    draw_line(x1, y1, x2, y2, color);
    draw_line(x2, y2, x0, y0, color);
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
        inv_slope_1 = (float)(x1 - x0) / g_abs(y1 - y0);
    if (y2 - y0 != 0)
        inv_slope_2 = (float)(x2 - x0) / g_abs(y2 - y0);

    if (y1 - y0 != 0)
    {
        for (int y = y0; y <= y1; y++)
        {
            int x_start = x1 + (y - y1) * inv_slope_1;
            int x_end = x0 + (y - y0) * inv_slope_2;

            if (x_end < x_start)
            {
                int_swap(&x_start, &x_end); // swap if x_start is to the right of x_end
            }

            for (int x = x_start; x < x_end; x++)
            {
                // Draw our pixel with the color that comes from the texture
                draw_triangle_texel(x, y, point_a, point_b, point_c, a_uv, b_uv, c_uv, light_intensity, texture);
            }
        }
    }
    ///////////////////////////////////////////////////////
    // Render the bottom part of the triangle (flat-top)
    ///////////////////////////////////////////////////////
    inv_slope_1 = 0;
    inv_slope_2 = 0;

    if (y2 - y1 != 0)
        inv_slope_1 = (float)(x2 - x1) / g_abs(y2 - y1);
    if (y2 - y0 != 0)
        inv_slope_2 = (float)(x2 - x0) / g_abs(y2 - y0);

    if (y2 - y1 != 0)
    {
        for (int y = y1; y <= y2; y++)
        {
            int x_start = x1 + (y - y1) * inv_slope_1;
            int x_end = x0 + (y - y0) * inv_slope_2;

            if (x_end < x_start)
            {
                int_swap(&x_start, &x_end); // swap if x_start is to the right of x_end
            }

            for (int x = x_start; x < x_end; x++)
            {
                // Draw our pixel with the color that comes from the texture
                draw_triangle_texel(x, y, point_a, point_b, point_c, a_uv, b_uv, c_uv, light_intensity, texture);
            }
        }
    }
}
void draw_filled_triangle(
    int x0, int y0, float z0, float w0,
    int x1, int y1, float z1, float w1,
    int x2, int y2, float z2, float w2,
    int color)
{

    // We need to sort the vertices by y-coordinate ascending (y0 < y1 < y2)
    if (y0 > y1)
    {
        int_swap(&y0, &y1);
        int_swap(&x0, &x1);
        float_swap(&z0, &z1);
        float_swap(&w0, &w1);
    }
    if (y1 > y2)
    {
        int_swap(&y1, &y2);
        int_swap(&x1, &x2);
        float_swap(&z1, &z2);
        float_swap(&w1, &w2);
    }
    if (y0 > y1)
    {
        int_swap(&y0, &y1);
        int_swap(&x0, &x1);
        float_swap(&z0, &z1);
        float_swap(&w0, &w1);
    }

    // Create three vector points after we sort the vertices
    vec4_t point_a = {x0, y0, z0, w0};
    vec4_t point_b = {x1, y1, z1, w1};
    vec4_t point_c = {x2, y2, z2, w2};

    ///////////////////////////////////////////////////////
    // Render the upper part of the triangle (flat-bottom)
    ///////////////////////////////////////////////////////
    float inv_slope_1 = 0;
    float inv_slope_2 = 0;

    if (y1 - y0 != 0)
        inv_slope_1 = (float)(x1 - x0) / g_abs(y1 - y0);
    if (y2 - y0 != 0)
        inv_slope_2 = (float)(x2 - x0) / g_abs(y2 - y0);

    if (y1 - y0 != 0)
    {
        for (int y = y0; y <= y1; y++)
        {
            int x_start = x1 + (y - y1) * inv_slope_1;
            int x_end = x0 + (y - y0) * inv_slope_2;

            if (x_end < x_start)
            {
                int_swap(&x_start, &x_end); // swap if x_start is to the right of x_end
            }

            for (int x = x_start; x < x_end; x++)
            {
                // Draw our pixel with a solid color
                draw_triangle_pixel(x, y, color, point_a, point_b, point_c);
            }
        }
    }

    ///////////////////////////////////////////////////////
    // Render the bottom part of the triangle (flat-top)
    ///////////////////////////////////////////////////////
    inv_slope_1 = 0;
    inv_slope_2 = 0;

    if (y2 - y1 != 0)
        inv_slope_1 = (float)(x2 - x1) / g_abs(y2 - y1);
    if (y2 - y0 != 0)
        inv_slope_2 = (float)(x2 - x0) / g_abs(y2 - y0);

    if (y2 - y1 != 0)
    {
        for (int y = y1; y <= y2; y++)
        {
            int x_start = x1 + (y - y1) * inv_slope_1;
            int x_end = x0 + (y - y0) * inv_slope_2;

            if (x_end < x_start)
            {
                int_swap(&x_start, &x_end); // swap if x_start is to the right of x_end
            }

            for (int x = x_start; x < x_end; x++)
            {
                // Draw our pixel with a solid color
                draw_triangle_pixel(x, y, color, point_a, point_b, point_c);
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
    int tex_x = g_abs((int)(interpolated_u * texture.width)) % texture.width;
    int tex_y = g_abs((int)(interpolated_v * texture.height)) % texture.height;

    // Adjust 1/w so the pixels that are closer to the camera have smaller values
    interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;

    // Only draw the pixel if the depth value is less than the one previously stored in the z-buffer
    if (interpolated_reciprocal_w < display.z_buffer[(display.width * y) + x])
    {
        int color = light_apply_intensity(texture.data[(texture.width * tex_y) + tex_x], light_intensity);

        // Draw a pixel at position (x,y) with the color that comes from the mapped texture
        draw_pixel(x, y, color);

        // Update the z-buffer value with the 1/w of this current pixel
        display.z_buffer[(display.width * y) + x] = interpolated_reciprocal_w;
    }
}
void draw_triangle_pixel(
    int x, int y, int color,
    vec4_t point_a, vec4_t point_b, vec4_t point_c)
{
    // Create three vec2 to find the interpolation
    vec2_t p = {x, y};
    vec2_t a = vec2_from_vec4(point_a);
    vec2_t b = vec2_from_vec4(point_b);
    vec2_t c = vec2_from_vec4(point_c);

    // Calculate the barycentric coordinates of our point 'p' inside the triangle
    vec3_t weights = barycentric_weights(a, b, c, p);

    float alpha = weights.x;
    float beta = weights.y;
    float gamma = weights.z;

    // Interpolate the value of 1/w for the current pixel
    float interpolated_reciprocal_w = (1 / point_a.w) * alpha + (1 / point_b.w) * beta + (1 / point_c.w) * gamma;

    // Adjust 1/w so the pixels that are closer to the camera have smaller values
    interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;

    // Only draw the pixel if the depth value is less than the one previously stored in the z-buffer
    if (interpolated_reciprocal_w < display.z_buffer[(display.width * y) + x])
    {
        // Draw a pixel at position (x,y) with a solid color
        draw_pixel(x, y, color);

        // Update the z-buffer value with the 1/w of this current pixel
        display.z_buffer[(display.width * y) + x] = interpolated_reciprocal_w;
    }
}

void draw_pixel(int x, int y, int color)
{
    if (x >= 0 && x < display.width && y >= 0 && y < display.height)
    {
        display.color_buffer[(display.width * y) + x] = color;
    }
}
void draw_line(int x0, int y0, int x1, int y1, int color)
{
    int delta_x = (x1 - x0);
    int delta_y = (y1 - y0);

    int longest_side_length = (abs(delta_x) >= abs(delta_y)) ? abs(delta_x) : abs(delta_y);

    float x_inc = delta_x / (float)longest_side_length;
    float y_inc = delta_y / (float)longest_side_length;

    float current_x = x0;
    float current_y = y0;

    for (int i = 0; i <= longest_side_length; i++)
    {
        draw_pixel((int)current_x, (int)current_y, color);
        current_x += x_inc;
        current_y += y_inc;
    }
}

void apply_fisheye()
{
    int centerX = display.half_width; // X coordinate of the fisheye center
    float distortion = 10.5;
    int width = display.width;
    int height = display.height;

    // Iterate through each pixel in the image buffer
    for (int y = 0; y < height; y++)
    {
        for (int x = 0; x < width; x++)
        {
            // Calculate the distance from the center
            int dx = x - centerX;

            // Calculate the distortion factor
            float distortionFactor = distortion * dx * dx / (width * width);

            // Calculate the new y-coordinate
            int newY = y + distortionFactor;

            // Check if the new y-coordinate is within the image bounds
            if (newY >= 0 && newY < height)
            {
                // Interpolate the color value from the original image buffer
                unsigned int color = display.color_buffer[newY * width + x];

                // Assign the interpolated color to the pixel
                display.color_buffer[y * width + x] = color;
            }
        }
    }
}

void clear_color_buffer(int color)
{
    for (int y = 0; y < display.height; y++)
    {
        for (int x = 0; x < display.width; x++)
        {
            display.color_buffer[(display.width * y) + x] = color;
        }
    }
}
void clear_z_buffer(void)
{
    for (int y = 0; y < display.height; y++)
    {
        for (int x = 0; x < display.width; x++)
        {
            display.z_buffer[(display.width * y) + x] = 1.0f;
        }
    }
}

unsigned int *set_render_mode()
{
    unsigned int *render_mode_buffer = malloc(3 * sizeof(int));
    display.render_mode = render_mode_buffer;

    return render_mode_buffer;
}
