#include "texture.h"

inline double get_depth(vec3_t point, vec3_t light_position, vec3_t light_direction)
{
    // Calculate the projection of the point onto the light's view plane
    vec3_t light_to_point = {point.x - light_position.x, point.y - light_position.y, point.z - light_position.z};
    double projection = vec3_dot(light_to_point, light_direction) / vec3_dot(light_direction, light_direction);
    vec3_t projection_point = {light_position.x + projection * light_direction.x, light_position.y + projection * light_direction.y, light_position.z + projection * light_direction.z};

    // Calculate the distance from the projection point to the point
    return sqrt(pow(projection_point.x - point.x, 2) + pow(projection_point.y - point.y, 2) + pow(projection_point.z - point.z, 2));
}

// void render_shadow_map(rendertarget_t *shadow_map, triangle_t *triangles, int triangle_count, light_t light)
// {
//     // Clear the depth buffer
//     for (int i = 0; i < shadow_map->width * shadow_map->height; i++)
//     {
//         shadow_map->depth_buffer[i] = INFINITY;
//     }

//     // Render the triangles from the perspective of the light
//     for (int i = 0; i < triangle_count; i++)
//     {
//         triangle_t triangle = triangles[i];
//         vec3_t light_direction = {triangle.points[0].x - light.position.x, triangle.v1.position.y - light.position.y, triangle.v1.position.z - light.position.z};
//         double depth1 = get_depth(triangle.v1.position, light.position, light_direction);
//         double depth2 = get_depth(triangle.v2.position, light.position, light_direction);
//         double depth3 = get_depth(triangle.v3.position, light.position, light_direction);
//         // Calculate the bounding box of the triangle in light space
//         int min_x = (int)fmin(triangle.v1.position.x, fmin(triangle.v2.position.x, triangle.v3.position.x));
//         int max_x = (int)fmax(triangle.v1.position.x, fmax(triangle.v2.position.x, triangle.v3.position.x));
//         int min_y = (int)fmin(triangle.v1.position.y, fmin(triangle.v2.position.y, triangle.v3.position.y));
//         int max_y = (int)fmax(triangle.v1.position.y, fmax(triangle.v2.position.y, triangle.v3.position.y));

//         // Clip the bounding box to the viewport
//         min_x = fmax(min_x, 0);
//         max_x = fmin(max_x, shadow_map->width - 1);
//         min_y = fmax(min_y, 0);
//         max_y = fmin(max_y, shadow_map->height - 1);

//         // Rasterize the triangle
//         for (int y = min_y; y <= max_y; y++)
//         {
//             for (int x = min_x; x <= max_x; x++)
//             {
//                 // Calculate the barycentric coordinates of the point
//                 vec3_t p = {(double)x + 0.5, (double)y + 0.5, 0};
//                 double w1 = triangle_area(triangle.v2.position, triangle.v3.position, p) / triangle_area(triangle.v1.position, triangle.v2.position, triangle.v3.position);
//                 double w2 = triangle_area(triangle.v3.position, triangle.v1.position, p) / triangle_area(triangle.v1.position, triangle.v2.position, triangle.v3.position);
//                 double w3 = triangle_area(triangle.v1.position, triangle.v2.position, p) / triangle_area(triangle.v1.position, triangle.v2.position, triangle.v3.position);
//                 if (w1 >= 0 && w2 >= 0 && w3 >= 0)
//                 {
//                     // Interpolate the depth value
//                     double depth = w1 * depth1 + w2 * depth2 + w3 * depth3;

//                     // Update the depth buffer if the point is closer to the light
//                     int index = y * shadow_map->width + x;
//                     if (depth < shadow_map->depth_buffer[index])
//                     {
//                         shadow_map->depth_buffer[index] = depth;
//                     }
//                 }
//             }
//         }
//     }
// }