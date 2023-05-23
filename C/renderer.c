#include "renderer.h"
#include "camera3d.h"

void render_object(object3d_t *obj3d, mat4_t view_matrix)
{

    float_log(light3d->direction[0]);
    float_log(light3d->direction[1]);
    float_log(light3d->direction[2]);
}

void transform_object(mat4_t view_matrix, mat4_t proj_matrix, object3d_t *obj3d, display_size_t display, vec3_t light_dir)
{
    int num_triangles_to_render = 0;

    vec3_t pos = (vec3_t){.x = obj3d->position[0], .y = obj3d->position[1], .z = obj3d->position[2]};
    vec3_t rot = (vec3_t){.x = obj3d->rotation[0], .y = obj3d->rotation[1], .z = obj3d->rotation[2]};
    vec3_t scl = (vec3_t){.x = obj3d->scale[0], .y = obj3d->scale[1], .z = obj3d->scale[2]};

    mat4_t scale_matrix = mat4_make_scale(scl.x, scl.y, scl.z);
    mat4_t translation_matrix = mat4_make_translation(pos);
    mat4_t rotation_matrix = mat4_make_rotation(rot);

    // // Create a World Matrix combining scale, rotation, and translation matrices
    mat4_t world_matrix = mat4_identity();

    // // Order matters: First scale, then rotate, then translate. [T]*[R]*[S]*v
    world_matrix = mat4_mul_mat4(scale_matrix, world_matrix);
    world_matrix = mat4_mul_mat4(rotation_matrix, world_matrix);
    world_matrix = mat4_mul_mat4(translation_matrix, world_matrix);

    // Calculate the shade intensity based on how aliged is the normal with the flipped light direction ray
    // vec3_t light_dir = mat4_mul_vec3(view_matrix, vec3_new(light3d->direction[0], light3d->direction[1], light3d->direction[2]));

    for (int i = 0; i < obj3d->mesh.num_triangles; i++)
    {
        // Get the triangle to transform
        triangle_t triangle = obj3d->mesh.triangles[i];
        // Fix this!!
        triangle.color = 0xffa5a5a5;

        vec4_t transformed_vertices[3];
        for (int j = 0; j < 3; j++)
        {
            // Get the triangle points, transform those, and collect them in the
            // transformed vertices array
            vec3_t point = vec3_clone(&triangle.points[j]);
            vec4_t transformed_vertex = vec4_from_vec3(point);
            transformed_vertex = mat4_mul_vec4(world_matrix, transformed_vertex);
            transformed_vertex = mat4_mul_vec4(view_matrix, transformed_vertex);

            transformed_vertices[j] = transformed_vertex;
        }
        // Get individual vectors from A, B, and C vertices to compute normal
        vec3_t vector_a = vec3_from_vec4(transformed_vertices[0]); /*   A   */
        vec3_t vector_b = vec3_from_vec4(transformed_vertices[1]); /*  / \  */
        vec3_t vector_c = vec3_from_vec4(transformed_vertices[2]); /* C---B */

        // Get the vector subtraction of B-A and C-A
        vec3_t vector_ab = vec3_sub(vector_b, vector_a);
        vec3_t vector_ac = vec3_sub(vector_c, vector_a);
        vec3_normalize(&vector_ab);
        vec3_normalize(&vector_ac);

        // Compute the face normal (using cross product to find perpendicular)
        vec3_t normal = vec3_cross(vector_ab, vector_ac);
        vec3_normalize(&normal);

        // Find the vector between vertex A in the triangle and the camera origin
        vec3_t origin = {0, 0, 0};
        vec3_t camera_ray = vec3_sub(origin, vector_a);

        // Calculate how aligned the camera ray is with the face normal (using dot product)
        float dot_normal_camera = vec3_dot(normal, camera_ray);

        // Backface culling, bypassing triangles that are looking away from the camera
        if (dot_normal_camera < 0)
        {
            continue;
        }
        // Create a polygon from the original transformed triangle to be clipped
        polygon_t polygon = polygon_from_triangle(
            vec3_from_vec4(transformed_vertices[0]),
            vec3_from_vec4(transformed_vertices[1]),
            vec3_from_vec4(transformed_vertices[2]),
            triangle);

        // Clip the polygon and returns a new polygon with potential new vertices
        clip_polygon(&polygon);
        float light_intensity_factor = -vec3_dot(normal, light_dir);

        // Break the clipped polygon apart back into individual triangles
        triangle_t triangles_after_clipping[MAX_NUM_POLY_TRIANGLES];
        int num_triangles_after_clipping = 0;

        triangles_from_polygon(&polygon, triangles_after_clipping, &num_triangles_after_clipping);

        for (int t = 0; t < num_triangles_after_clipping; t++)
        {
            triangle_t triangle_after_clipping = triangles_after_clipping[t];
            triangle_after_clipping.color = 0xffffffff;

            vec4_t projected_points[3];

            // Loop all three vertices to perform projection and conversion to screen space
            for (int j = 0; j < 3; j++)
            {
                // Project the current vertex using a perspective projection matrix
                projected_points[j] = mat4_mul_vec4(proj_matrix, triangle_after_clipping.clipped_points[j]);

                // Perform perspective divide
                if (projected_points[j].w != 0)
                {
                    projected_points[j].x /= projected_points[j].w;
                    projected_points[j].y /= projected_points[j].w;
                    projected_points[j].z /= projected_points[j].w;
                }

                // Flip vertically since the y values of the 3D mesh grow bottom->up and in screen space y values grow top->down
                projected_points[j].x *= -1;
                projected_points[j].y *= -1;

                // Scale into the view
                projected_points[j].x *= (display.width / 2.0);
                projected_points[j].y *= (display.height / 2.0);

                // Translate the projected points to the middle of the screen
                projected_points[j].x += (display.width / 2.0);
                projected_points[j].y += (display.height / 2.0);
            }

            // Calculate the triangle color based on the light angle
            int triangle_color = light_apply_intensity(triangle.color, light_intensity_factor);

            // Create the final projected triangle that will be rendered in screen space
            // Save the projected triangle in the array of triangles to render
            if (num_triangles_to_render < MAX_TRIANGLES)
            {
                triangle_t triangle_to_render = {
                    .projected_points = {
                        {projected_points[0].x, projected_points[0].y, projected_points[0].z, projected_points[0].w},
                        {projected_points[1].x, projected_points[1].y, projected_points[1].z, projected_points[1].w},
                        {projected_points[2].x, projected_points[2].y, projected_points[2].z, projected_points[2].w}},
                    .projected_uvs = {{triangle_after_clipping.clipped_uvs[0].u, triangle_after_clipping.clipped_uvs[0].v}, {triangle_after_clipping.clipped_uvs[1].u, triangle_after_clipping.clipped_uvs[1].v}, {triangle_after_clipping.clipped_uvs[2].u, triangle_after_clipping.clipped_uvs[2].v}},
                    .color = triangle_color,
                    .light_intensity = light_intensity_factor};

                obj3d->mesh.triangles_to_render[num_triangles_to_render] = triangle_to_render;
                num_triangles_to_render++;
            }
        }
    }
    obj3d->mesh.num_triangles_to_render = num_triangles_to_render;
}