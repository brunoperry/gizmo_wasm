#include "clipping.h"

clipping_t init_frustum_planes()
{

    clipping_t out;

    float val = 60 / 2.0;

    float cos_half_fov_x = cos(val);
    float sin_half_fov_x = sin(val);
    float cos_half_fov_y = cos(val);
    float sin_half_fov_y = sin(val);

    out.frustum_planes[LEFT_FRUSTUM_PLANE] = (plane_t){vec3_new(0, 0, 0), vec3_new(cos_half_fov_x, 0, sin_half_fov_x)};
    out.frustum_planes[RIGHT_FRUSTUM_PLANE] = (plane_t){vec3_new(0, 0, 0), vec3_new(-cos_half_fov_x, 0, sin_half_fov_x)};
    out.frustum_planes[TOP_FRUSTUM_PLANE] = (plane_t){vec3_new(0, 0, 0), vec3_new(0, -cos_half_fov_y, sin_half_fov_y)};
    out.frustum_planes[BOTTOM_FRUSTUM_PLANE] = (plane_t){vec3_new(0, 0, 0), vec3_new(0, cos_half_fov_y, sin_half_fov_y)};
    out.frustum_planes[NEAR_FRUSTUM_PLANE] = (plane_t){vec3_new(0, 0, 0.1), vec3_new(0, 0, 1)};
    out.frustum_planes[FAR_FRUSTUM_PLANE] = (plane_t){vec3_new(0, 0, 300), vec3_new(0, 0, -1)};

    return out;
}

void clip_polygon_against_plane(polygon_t *polygon, plane_t plane)
{

    // if (plane == clipping.frustum_planes[TOP_FRUSTUM_PLANE])
    // {

    // }
    log_int(polygon->num_vertices);
    vec3_t plane_point = plane.point;
    vec3_t plane_normal = plane.normal;

    // Declare a static array of inside vertices that will be part of the final polygon returned via parameter
    vec3_t inside_vertices[MAX_NUM_POLY_VERTICES];
    int num_inside_vertices = 0;

    vec3_t current_vertex = vec4_to_vec3(polygon->vertices[0]);
    // Start the previous vertex with the last polygon vertex and texture coordinate
    vec3_t previous_vertex = vec4_to_vec3(polygon->vertices[polygon->num_vertices - 1]);

    float current_dot = 0;
    float previous_dot = vec3_dot(vec3_sub_vecs(previous_vertex, plane_point), plane_normal);

    for (size_t i = 1; i < polygon->num_vertices; i++)
    {
        current_dot = vec3_dot(vec3_sub_vecs(current_vertex, plane_point), plane_normal);

        if (current_dot * previous_dot < 0)
        {
            // Find the interpolation factor t
            float t = previous_dot / (previous_dot - current_dot);

            // Calculate the intersection point I = Q1 + t(Q2-Q1)
            vec3_t intersection_point = {
                .x = float_lerp(previous_vertex.x, current_vertex.x, t),
                .y = float_lerp(previous_vertex.y, current_vertex.y, t),
                .z = float_lerp(previous_vertex.z, current_vertex.z, t)};

            // Insert the intersection point to the list of "inside vertices"
            inside_vertices[num_inside_vertices] = vec3_clone(&intersection_point);
            num_inside_vertices++;
        }

        if (current_dot > 0)
        {
            // Insert the current vertex to the list of "inside vertices"
            inside_vertices[num_inside_vertices] = vec3_clone(&current_vertex);
            num_inside_vertices++;
        }

        // Move to the next vertex
        previous_dot = current_dot;
        previous_vertex = current_vertex;
        current_vertex = vec4_to_vec3(polygon->vertices[i]);
    }
    for (int i = 0; i < num_inside_vertices; i++)
    {
        polygon->vertices[i] = vec4_merge_vec3(polygon->vertices[i], inside_vertices[i]);
    }

    polygon->num_vertices = num_inside_vertices;
}

void clip_polygon(clipping_t clipping, polygon_t *polygon)
{
    clip_polygon_against_plane(&polygon, clipping.frustum_planes[LEFT_FRUSTUM_PLANE]);
    // clip_polygon_against_plane(&polygon, clipping.frustum_planes[RIGHT_FRUSTUM_PLANE]);
    // clip_polygon_against_plane(&polygon, clipping.frustum_planes[TOP_FRUSTUM_PLANE]);
    // clip_polygon_against_plane(&polygon, clipping.frustum_planes[BOTTOM_FRUSTUM_PLANE]);
    // clip_polygon_against_plane(&polygon, clipping.frustum_planes[NEAR_FRUSTUM_PLANE]);
    // clip_polygon_against_plane(&polygon, clipping.frustum_planes[FAR_FRUSTUM_PLANE]);
}