#include "stdlib.h"
#include "wasm.h"

#include "display.h"
#include "renderer.h"
#include "camera3d.h"
#include "light3d.h"
#include "object.h"
#include "vector.h"
#include "matrix.h"

static display_size_t display_size;

EXPORT unsigned int *set_color_buffer(int width, int height)
{
    display_size.width = width;
    display_size.height = height;
    display_size.center_x = width / 2;
    display_size.center_y = height / 2;
    return display_create(width, height);
}
EXPORT unsigned int *set_render_mode_buffer()
{
    return set_render_mode();
}
EXPORT unsigned int *set_texture_buffer(int width, int height, int id)
{
    return add_texture(width, height, id);
}
static camera_t camera_to_build;
static light_t light_to_build;

#define MAX_OBJECTS 10

static object3d_to_build_t object_to_build;
static object3d_t *objs3d[MAX_OBJECTS];
static int total_objs3d = 0;

EXPORT unsigned int *set_camera_buffer()
{
    unsigned int *camera_buffer = malloc(9 * sizeof(int));

    camera_to_build.aspect_x = malloc(sizeof(float));
    camera_to_build.aspect_y = malloc(sizeof(float));
    camera_to_build.fov_x = malloc(sizeof(float));
    camera_to_build.fov_y = malloc(sizeof(float));
    camera_to_build.z_near = malloc(sizeof(float));
    camera_to_build.z_far = malloc(sizeof(float));

    camera_to_build.position = malloc(3 * sizeof(float));
    camera_to_build.direction = malloc(3 * sizeof(float));
    camera_to_build.up = malloc(3 * sizeof(float));

    camera_buffer[0] = (unsigned int)camera_to_build.aspect_x;
    camera_buffer[1] = (unsigned int)camera_to_build.aspect_y;
    camera_buffer[2] = (unsigned int)camera_to_build.fov_x;
    camera_buffer[3] = (unsigned int)camera_to_build.fov_y;
    camera_buffer[4] = (unsigned int)camera_to_build.z_near;
    camera_buffer[5] = (unsigned int)camera_to_build.z_far;

    camera_buffer[6] = (unsigned int)camera_to_build.position;
    camera_buffer[7] = (unsigned int)camera_to_build.direction;
    camera_buffer[8] = (unsigned int)camera_to_build.up;

    return camera_buffer;
}
EXPORT unsigned int *set_light_buffer()
{
    unsigned int *light_buffer = malloc(2 * sizeof(int));
    light_to_build.direction = malloc(3 * sizeof(int));
    light_buffer[0] = (unsigned int)light_to_build.direction;

    return light_buffer;
}
EXPORT unsigned int *set_object_buffer(int v_length, int uv_length, int n_length, int textureID)
{
    unsigned int *obj_buffer = malloc(7 * sizeof(int));

    object_to_build.v_buffer = malloc(v_length * sizeof(float));
    object_to_build.v_buffer_len = v_length;

    object_to_build.uv_buffer = malloc(uv_length * sizeof(float));
    object_to_build.uv_buffer_len = uv_length;

    object_to_build.n_buffer = malloc(n_length * sizeof(float));
    object_to_build.n_buffer_len = n_length;

    object_to_build.textureID = textureID;

    object_to_build.p_buffer = malloc(3 * sizeof(float));
    object_to_build.r_buffer = malloc(3 * sizeof(float));
    object_to_build.s_buffer = malloc(3 * sizeof(float));

    obj_buffer[0] = (unsigned int)object_to_build.v_buffer;
    obj_buffer[1] = (unsigned int)object_to_build.uv_buffer;
    obj_buffer[2] = (unsigned int)object_to_build.n_buffer;
    obj_buffer[3] = (unsigned int)object_to_build.p_buffer;
    obj_buffer[4] = (unsigned int)object_to_build.r_buffer;
    obj_buffer[5] = (unsigned int)object_to_build.s_buffer;
    obj_buffer[6] = (unsigned int)object_to_build.textureID;

    return obj_buffer;
}

EXPORT void obj_done()
{
    objs3d[total_objs3d] = obj3d_build(&object_to_build);
    total_objs3d++;
}
EXPORT void cam_done()
{
    camera3d = camera_build(&camera_to_build);
}
EXPORT void light_done()
{
    light3d = light_build(&light_to_build);
}

EXPORT void update()
{
    clear_z_buffer();
    clear_color_buffer(0x22FF0000);
    mat4_t view_matrix = cam_view();
    mat4_t proj_matrix = camera3d->proj_matrix;
    vec3_t light_dir = mat4_mul_vec3(view_matrix, vec3_new(light3d->direction[0], light3d->direction[1], light3d->direction[2]));

    int total_tris = 0;
    for (int i = 0; i < total_objs3d; i++)
    {
        transform_object(view_matrix, proj_matrix, objs3d[i], display_size, light_dir);
        total_tris += objs3d[i]->mesh.num_triangles_to_render;
        draw(objs3d[i]);
    }
    info_log(total_tris, total_tris * 3);
}

EXPORT void apply_filter(int filter)
{
    if (filter == 0)
    {
        apply_barrel_distortion(display_size);
    }
    else if (filter == 1)
    {
        apply_fisheye(display_size);
    }
}