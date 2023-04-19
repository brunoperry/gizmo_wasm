#include "walloc.h"
#include "wasm.h"

#include "display.h"
#include "camera3d.h"
#include "object3d.h"

#define MAX_OBJECTS 10

static display_t *display;
static object3d_t *objs3d[MAX_OBJECTS];
static int total_objs3d = 0;
static camera3d_t *camera;

EXPORT unsigned int *set_display_buffer(int width, int height)
{
    display = display_build(width, height);
    return display->color_buffer;
}
EXPORT unsigned int *set_camera_buffer()
{
    unsigned int *cam_buffer = malloc(7 * sizeof(int));
    camera = camera_build(cam_buffer);
    return cam_buffer;
}
EXPORT unsigned int *set_light_buffer()
{
    unsigned int *light_buffer = malloc(1 * sizeof(int));
    return light_buffer;
}

// The object buffer is made of 4 buffers
// - Vertex buffer (mesh)
// - UV buffer (mesh)
// - Normal buffer (mesh)
// - Transform matrix (transform)

EXPORT unsigned int *set_object_buffer(int v_length, int uv_length, int n_length)
{
    unsigned int *obj_buffer = malloc(5 * sizeof(int));

    objs3d[total_objs3d] = obj3d_build(obj_buffer, (int[]){v_length, uv_length, n_length});
    total_objs3d++;

    return obj_buffer;
}

EXPORT void initialize()
{
    for (size_t i = 0; i < total_objs3d; i++)
    {
        obj3d_initialize(objs3d[i]);
    }
}

EXPORT void update_once()
{
    display_clear(display, 0x000000FF);

    mat4_t view_matrix = mat4_from_buffer(camera->view_buffer);
    mat4_t projection_matrix = mat4_from_buffer(camera->projection_buffer);

    for (int i = 0; i < total_objs3d; i++)
    {
        mat4_t model_matrix = mat4_from_buffer(objs3d[i]->transform_buffer);

        mat4_t modelView = mat4_mul_mat4(view_matrix, model_matrix);
        mat4_t mvp = mat4_mul_mat4(projection_matrix, modelView);

        display_draw(display, objs3d[i], mvp);
    }
}
EXPORT void update()
{
    display_clear(display, 0x000000FF);

    mat4_t view_matrix = mat4_from_buffer(camera->view_buffer);
    mat4_t projection_matrix = mat4_from_buffer(camera->projection_buffer);

    for (int i = 0; i < total_objs3d; i++)
    {
        mat4_t model_matrix = mat4_from_buffer(objs3d[i]->transform_buffer);

        mat4_t modelView = mat4_mul_mat4(view_matrix, model_matrix);
        mat4_t mvp = mat4_mul_mat4(projection_matrix, modelView);

        display_draw(display, objs3d[i], mvp);
    }
}