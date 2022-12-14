#include "walloc.h"
#include "wasm.h"

#include "display.h"
#include "renderer.h"
#include "camera.h"
#include "light.h"
#include "object.h"
#include "gmath.h"

static display_size_t display_size;
EXPORT unsigned int *set_color_buffer(int width, int height)
{
    display_size.width = width;
    display_size.height = height;
    return display_create(width, height);
}
EXPORT unsigned int *set_render_mode_buffer()
{
    return set_render_mode();
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
    unsigned int *light_buffer = malloc(1 * sizeof(int));
    light_to_build.direction = malloc(3 * sizeof(int));
    light_buffer[0] = (unsigned int)light_to_build.direction;

    return light_buffer;
}
EXPORT unsigned int *set_object_buffer(int v_length, int uv_length, int n_length, int t_width, int t_height)
{
    unsigned int *obj_buffer = malloc(7 * sizeof(int));

    object_to_build.v_buffer = malloc(v_length * sizeof(float));
    object_to_build.v_buffer_len = v_length;

    object_to_build.uv_buffer = malloc(uv_length * sizeof(float));
    object_to_build.uv_buffer_len = uv_length;

    object_to_build.n_buffer = malloc(n_length * sizeof(float));
    object_to_build.n_buffer_len = n_length;

    int length = t_width * t_height;
    object_to_build.t_buffer = malloc(length * sizeof(int));
    object_to_build.t_width = t_width;
    object_to_build.t_height = t_height;

    object_to_build.p_buffer = malloc(3 * sizeof(float));
    object_to_build.r_buffer = malloc(3 * sizeof(float));
    object_to_build.s_buffer = malloc(3 * sizeof(float));

    obj_buffer[0] = (unsigned int)object_to_build.v_buffer;
    obj_buffer[1] = (unsigned int)object_to_build.uv_buffer;
    obj_buffer[2] = (unsigned int)object_to_build.n_buffer;
    obj_buffer[3] = (unsigned int)object_to_build.p_buffer;
    obj_buffer[4] = (unsigned int)object_to_build.r_buffer;
    obj_buffer[5] = (unsigned int)object_to_build.s_buffer;
    obj_buffer[6] = (unsigned int)object_to_build.t_buffer;

    return obj_buffer;
}

EXPORT void obj_done()
{
    objs3d[total_objs3d] = obj3d_build(&object_to_build);
    total_objs3d++;
}
EXPORT void cam_done()
{
    camera = camera_build(&camera_to_build);
}
EXPORT void light_done()
{
    light = light_build(&light_to_build);
}

EXPORT void update()
{
    clear_z_buffer();
    clear_color_buffer(0xFF1d0501);
    mat4_t view_matrix = cam_view(camera);

    // double angle = cosine(12);

    // console_log(123, angle);

    int total_tris = 0;
    for (int i = 0; i < total_objs3d; i++)
    {
        transform_object(*camera, view_matrix, objs3d[i], light, display_size);
        total_tris += objs3d[i]->mesh.num_triangles_to_render;
        draw(objs3d[i]);
    }

    info_log(total_tris, total_tris * 3);
}