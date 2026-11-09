#include "camera3d.h"

camera_t camera3d;

void camera_frame(camera_frame_t *f)
{
    vec3_t eye = vec3_from_ptr(camera3d.position);
    vec3_t dir = vec3_normalize_or(vec3_from_ptr(camera3d.direction), vec3_new(0, 0, 1));
    vec3_t up = vec3_from_ptr(camera3d.up);

    // Looking straight up/down makes dir x up degenerate: fall back to world x.
    vec3_t right = vec3_normalize_or(vec3_cross(dir, up), vec3_new(1, 0, 0));
    vec3_t true_up = vec3_cross(right, dir);

    // Rows are the camera basis; translation moves the eye to the origin.
    f->view = (mat4_t){{{right.x, right.y, right.z, -vec3_dot(right, eye)},
                        {true_up.x, true_up.y, true_up.z, -vec3_dot(true_up, eye)},
                        {dir.x, dir.y, dir.z, -vec3_dot(dir, eye)},
                        {0, 0, 0, 1}}};

    f->proj_y = 1.0f / tanf(camera3d.fov_y[0] * 0.5f);
    f->proj_x = camera3d.aspect_y[0] * f->proj_y;
    f->z_near = camera3d.z_near[0];
    f->z_far = camera3d.z_far[0];
}
