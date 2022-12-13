#include "camera.h"

camera_t *camera_build(camera_t *cam_to_build)
{
    camera = (camera_t *)malloc(sizeof(camera_t));

    camera->aspect_x = cam_to_build->aspect_x;
    camera->aspect_y = cam_to_build->aspect_y;
    camera->fov_x = cam_to_build->fov_x;
    camera->fov_y = cam_to_build->fov_y;

    camera->z_near = cam_to_build->z_near;
    camera->z_far = cam_to_build->z_far;

    camera->position = cam_to_build->position;
    camera->direction = cam_to_build->direction;
    camera->up = cam_to_build->up;

    camera->proj_matrix = mat4_make_perspective(camera->fov_y[0], camera->aspect_y[0], camera->z_near[0], camera->z_far[0]);

    init_frustum_planes();

    return camera;
}

mat4_t cam_view(camera_t *camera)
{
    vec3_t dir = vec3_new(camera->direction[0],
                          camera->direction[1],
                          camera->direction[2]);

    vec3_t pos = vec3_new(camera->position[0],
                          camera->position[1],
                          camera->position[2]);

    vec3_t up = vec3_new(camera->up[0],
                         camera->up[1],
                         camera->up[2]);

    mat4_t view_matrix = mat4_make_translation(pos);
    vec3_t center = vec3_add(pos, dir);
    mat4_t look_at = mat4_look_at(pos, center, up);

    return mat4_mul_mat4(look_at, view_matrix);
}

mat4_t cam_look_at(camera_t *camera, vec3_t target)
{
    vec3_t pos = vec3_new(camera->position[0],
                          camera->position[1],
                          camera->position[2]);

    vec3_t up = vec3_new(camera->up[0],
                         camera->up[1],
                         camera->up[2]);

    vec3_t z = vec3_sub(target, pos);
    vec3_normalize(&z);
    vec3_t x = vec3_cross(up, z);
    vec3_normalize(&x);
    vec3_t y = vec3_cross(z, x);

    mat4_t view_matrix = {
        {{x.x, x.y, x.z, -vec3_dot(x, pos)},
         {y.x, y.y, y.z, -vec3_dot(y, pos)},
         {z.x, z.y, z.z, -vec3_dot(z, pos)},
         {0, 0, 0, 1}}};

    return view_matrix;
}

// Clipping
#define NUM_PLANES 6

void init_frustum_planes()
{
    float cos_half_fov_x = g_cos(camera->fov_x[0] / (float)2.0);
    float sin_half_fov_x = g_sin(camera->fov_x[0] / (float)2.0);
    float cos_half_fov_y = g_cos(camera->fov_y[0] / (float)2.0);
    float sin_half_fov_y = g_sin(camera->fov_y[0] / (float)2.0);

    camera->frustum_planes[LEFT_FRUSTUM_PLANE].point = vec3_new(0, 0, 0);
    camera->frustum_planes[LEFT_FRUSTUM_PLANE].normal.x = cos_half_fov_x;
    camera->frustum_planes[LEFT_FRUSTUM_PLANE].normal.y = 0;
    camera->frustum_planes[LEFT_FRUSTUM_PLANE].normal.z = sin_half_fov_x;

    camera->frustum_planes[RIGHT_FRUSTUM_PLANE].point = vec3_new(0, 0, 0);
    camera->frustum_planes[RIGHT_FRUSTUM_PLANE].normal.x = -cos_half_fov_x;
    camera->frustum_planes[RIGHT_FRUSTUM_PLANE].normal.y = 0;
    camera->frustum_planes[RIGHT_FRUSTUM_PLANE].normal.z = sin_half_fov_x;

    camera->frustum_planes[TOP_FRUSTUM_PLANE].point = vec3_new(0, 0, 0);
    camera->frustum_planes[TOP_FRUSTUM_PLANE].normal.x = 0;
    camera->frustum_planes[TOP_FRUSTUM_PLANE].normal.y = -cos_half_fov_y;
    camera->frustum_planes[TOP_FRUSTUM_PLANE].normal.z = sin_half_fov_y;

    camera->frustum_planes[BOTTOM_FRUSTUM_PLANE].point = vec3_new(0, 0, 0);
    camera->frustum_planes[BOTTOM_FRUSTUM_PLANE].normal.x = 0;
    camera->frustum_planes[BOTTOM_FRUSTUM_PLANE].normal.y = cos_half_fov_y;
    camera->frustum_planes[BOTTOM_FRUSTUM_PLANE].normal.z = sin_half_fov_y;

    camera->frustum_planes[NEAR_FRUSTUM_PLANE].point = vec3_new(0, 0, *camera->z_near);
    camera->frustum_planes[NEAR_FRUSTUM_PLANE].normal.x = 0;
    camera->frustum_planes[NEAR_FRUSTUM_PLANE].normal.y = 0;
    camera->frustum_planes[NEAR_FRUSTUM_PLANE].normal.z = 1;

    camera->frustum_planes[FAR_FRUSTUM_PLANE].point = vec3_new(0, 0, *camera->z_far);
    camera->frustum_planes[FAR_FRUSTUM_PLANE].normal.x = 0;
    camera->frustum_planes[FAR_FRUSTUM_PLANE].normal.y = 0;
    camera->frustum_planes[FAR_FRUSTUM_PLANE].normal.z = -1;
}
polygon_t polygon_from_triangle(vec3_t v0, vec3_t v1, vec3_t v2, triangle_t triangle)
{
    return (polygon_t){
        .vertices = {v0, v1, v2},
        .texcoords = {triangle.uvs[0], triangle.uvs[1], triangle.uvs[2]},
        .num_vertices = 3};
    // return polygon;
}
void triangles_from_polygon(polygon_t *polygon, triangle_t triangles[], int *num_triangles)
{
    for (int i = 0; i < polygon->num_vertices - 2; i++)
    {
        int index0 = 0;
        int index1 = i + 1;
        int index2 = i + 2;

        triangles[i].clipped_points[0] = vec4_from_vec3(polygon->vertices[index0]);
        triangles[i].clipped_points[1] = vec4_from_vec3(polygon->vertices[index1]);
        triangles[i].clipped_points[2] = vec4_from_vec3(polygon->vertices[index2]);

        triangles[i].clipped_uvs[0] = polygon->texcoords[index0];
        triangles[i].clipped_uvs[1] = polygon->texcoords[index1];
        triangles[i].clipped_uvs[2] = polygon->texcoords[index2];
    }
    *num_triangles = polygon->num_vertices - 2;
}
void clip_polygon_against_plane(polygon_t *polygon, int plane)
{
    vec3_t plane_point = camera->frustum_planes[plane].point;
    vec3_t plane_normal = camera->frustum_planes[plane].normal;

    // Declare a static array of inside vertices that will be part of the final polygon returned via parameter
    vec3_t inside_vertices[MAX_NUM_POLY_VERTICES];
    tex2_t inside_texcoords[MAX_NUM_POLY_VERTICES];
    int num_inside_vertices = 0;

    // Start the current vertex with the first polygon vertex and texture coordinate
    vec3_t *current_vertex = &polygon->vertices[0];
    tex2_t *current_texcoord = &polygon->texcoords[0];

    // Start the previous vertex with the last polygon vertex and texture coordinate
    vec3_t *previous_vertex = &polygon->vertices[polygon->num_vertices - 1];
    tex2_t *previous_texcoord = &polygon->texcoords[polygon->num_vertices - 1];

    // Calculate the dot product of the current and previous vertex
    float current_dot = 0;
    float previous_dot = vec3_dot(vec3_sub(*previous_vertex, plane_point), plane_normal);

    // Loop all the polygon vertices while the current is different than the last one
    while (current_vertex != &polygon->vertices[polygon->num_vertices])
    {
        current_dot = vec3_dot(vec3_sub(*current_vertex, plane_point), plane_normal);

        // If we changed from inside to outside or from outside to inside
        if (current_dot * previous_dot < 0)
        {
            // Find the interpolation factor t
            float t = previous_dot / (previous_dot - current_dot);

            // Calculate the intersection point I = Q1 + t(Q2-Q1)
            vec3_t intersection_point = {
                .x = float_lerp(previous_vertex->x, current_vertex->x, t),
                .y = float_lerp(previous_vertex->y, current_vertex->y, t),
                .z = float_lerp(previous_vertex->z, current_vertex->z, t)};

            // Use the lerp formula to get the interpolated U and V texture coordinates
            tex2_t interpolated_texcoord = {
                .u = float_lerp(previous_texcoord->u, current_texcoord->u, t),
                .v = float_lerp(previous_texcoord->v, current_texcoord->v, t)};

            // Insert the intersection point to the list of "inside vertices"
            inside_vertices[num_inside_vertices] = vec3_clone(&intersection_point);
            inside_texcoords[num_inside_vertices] = tex2_clone(&interpolated_texcoord);
            num_inside_vertices++;
        }

        // Current vertex is inside the plane
        if (current_dot > 0)
        {
            // Insert the current vertex to the list of "inside vertices"
            inside_vertices[num_inside_vertices] = vec3_clone(current_vertex);
            inside_texcoords[num_inside_vertices] = tex2_clone(current_texcoord);
            num_inside_vertices++;
        }

        // Move to the next vertex
        previous_dot = current_dot;
        previous_vertex = current_vertex;
        previous_texcoord = current_texcoord;
        current_vertex++;
        current_texcoord++;
    }

    // At the end, copy the list of inside vertices into the destination polygon (out parameter)
    for (int i = 0; i < num_inside_vertices; i++)
    {
        polygon->vertices[i] = vec3_clone(&inside_vertices[i]);
        polygon->texcoords[i] = tex2_clone(&inside_texcoords[i]);
    }
    polygon->num_vertices = num_inside_vertices;
}
void clip_polygon(polygon_t *polygon)
{
    clip_polygon_against_plane(polygon, LEFT_FRUSTUM_PLANE);
    clip_polygon_against_plane(polygon, RIGHT_FRUSTUM_PLANE);
    clip_polygon_against_plane(polygon, TOP_FRUSTUM_PLANE);
    clip_polygon_against_plane(polygon, BOTTOM_FRUSTUM_PLANE);
    clip_polygon_against_plane(polygon, NEAR_FRUSTUM_PLANE);
    clip_polygon_against_plane(polygon, FAR_FRUSTUM_PLANE);
}