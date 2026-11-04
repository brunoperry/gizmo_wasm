// Javascript-facing API. The protocol is: JS asks for a buffer, writes its
// data straight into wasm memory, then calls the matching *_done().
// Every set_* function returns 0 (NULL) on failure.
#include <stdint.h>
#include "wasm.h"
#include "memory.h"
#include "display.h"
#include "renderer.h"
#include "camera3d.h"
#include "light3d.h"
#include "texture.h"
#include "object.h"

#define CLEAR_COLOR 0x22FF0000u

static object3d_t *objects[MAX_OBJECTS];
static int total_objects = 0;
static object3d_t *pending_object = NULL;

static int camera_ready = 0;
static int light_ready = 0;

static float *alloc_floats(int count)
{
    return gz_alloc((size_t)(count > 0 ? count : 1) * sizeof(float));
}

EXPORT(set_color_buffer) uint32_t *set_color_buffer(int width, int height)
{
    if (width <= 0 || height <= 0)
        return NULL;
    return display_create(width, height);
}

EXPORT(set_render_mode_buffer) int32_t *set_render_mode_buffer(void)
{
    display.render_mode = gz_alloc(3 * sizeof(int32_t));
    return display.render_mode;
}

EXPORT(set_texture_buffer) uint32_t *set_texture_buffer(int width, int height, int id)
{
    (void)id; // textures are numbered in creation order
    texture_t *t = texture_create(width, height);
    return t ? t->pixels : NULL;
}

// Returns 9 pointers: aspect_x, aspect_y, fov_x, fov_y, z_near, z_far, position, direction, up
EXPORT(set_camera_buffer) uint32_t *set_camera_buffer(void)
{
    uint32_t *buffer = gz_alloc(9 * sizeof(uint32_t));
    float *data = alloc_floats(6 + 3 * 3);
    if (!buffer || !data)
        return NULL;

    camera3d.aspect_x = &data[0];
    camera3d.aspect_y = &data[1];
    camera3d.fov_x = &data[2];
    camera3d.fov_y = &data[3];
    camera3d.z_near = &data[4];
    camera3d.z_far = &data[5];
    camera3d.position = &data[6];
    camera3d.direction = &data[9];
    camera3d.up = &data[12];

    float *fields[9] = {camera3d.aspect_x, camera3d.aspect_y, camera3d.fov_x, camera3d.fov_y,
                        camera3d.z_near, camera3d.z_far, camera3d.position, camera3d.direction, camera3d.up};
    for (int i = 0; i < 9; i++)
        buffer[i] = (uint32_t)(uintptr_t)fields[i];
    return buffer;
}

// Returns 1 pointer: direction (vec3)
EXPORT(set_light_buffer) uint32_t *set_light_buffer(void)
{
    uint32_t *buffer = gz_alloc(sizeof(uint32_t));
    light3d.direction = alloc_floats(3);
    if (!buffer || !light3d.direction)
        return NULL;
    buffer[0] = (uint32_t)(uintptr_t)light3d.direction;
    return buffer;
}

// Returns 7 values: vertices, uvs, normals, position, rotation, scale pointers + texture id
EXPORT(set_object_buffer) uint32_t *set_object_buffer(int v_length, int uv_length, int n_length, int texture_id)
{
    if (total_objects >= MAX_OBJECTS || v_length < 0 || uv_length < 0 || n_length < 0)
        return NULL;

    int num_triangles = v_length / 9;
    // Always room for 6 uvs per triangle: models without uvs read zeros.
    int uv_alloc = uv_length > num_triangles * 6 ? uv_length : num_triangles * 6;

    object3d_t *obj = gz_alloc(sizeof(object3d_t));
    uint32_t *buffer = gz_alloc(7 * sizeof(uint32_t));
    if (!obj || !buffer)
        return NULL;

    obj->vertices = alloc_floats(v_length);
    obj->uvs = alloc_floats(uv_alloc);
    obj->normals = alloc_floats(n_length);
    obj->position = alloc_floats(3);
    obj->rotation = alloc_floats(3);
    obj->scale = alloc_floats(3);
    if (!obj->vertices || !obj->uvs || !obj->normals || !obj->position || !obj->rotation || !obj->scale)
        return NULL;

    obj->num_triangles = num_triangles;
    obj->texture_id = texture_id;
    obj->scale[0] = obj->scale[1] = obj->scale[2] = 1.0f;

    buffer[0] = (uint32_t)(uintptr_t)obj->vertices;
    buffer[1] = (uint32_t)(uintptr_t)obj->uvs;
    buffer[2] = (uint32_t)(uintptr_t)obj->normals;
    buffer[3] = (uint32_t)(uintptr_t)obj->position;
    buffer[4] = (uint32_t)(uintptr_t)obj->rotation;
    buffer[5] = (uint32_t)(uintptr_t)obj->scale;
    buffer[6] = (uint32_t)texture_id;

    pending_object = obj;
    return buffer;
}

EXPORT(obj_done) void obj_done(void)
{
    if (pending_object && total_objects < MAX_OBJECTS)
        objects[total_objects++] = pending_object;
    pending_object = NULL;
}

EXPORT(cam_done) void cam_done(void) { camera_ready = camera3d.position != NULL; }
EXPORT(light_done) void light_done(void) { light_ready = light3d.direction != NULL; }

EXPORT(update) void update(void)
{
    if (!display.color || !display.render_mode || !camera_ready || !light_ready)
        return;

    display_clear(CLEAR_COLOR);

    camera_frame_t frame;
    camera_frame(&frame);

    vec3_t light_dir = vec3_normalize_or(vec3_from_ptr(light3d.direction), vec3_new(0, -1, 0));
    vec3_t light_view = mat4_mul_dir(&frame.view, light_dir);

    int mode = display.render_mode[0];
    int total_tris = 0;
    for (int i = 0; i < total_objects; i++)
        total_tris += render_object(objects[i], &frame, light_view, mode);

    info_log(total_tris, total_tris * 3);
}

EXPORT(apply_filter) void apply_filter(int filter)
{
    if (display.color)
        display_apply_filter(filter);
}
