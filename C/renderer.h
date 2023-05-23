#ifndef RENDERER_H
#define RENDERER_H

#include "object.h"
#include "display.h"
#include "light3d.h"
#include "camera3d.h"

void render_object(object3d_t *obj3d, mat4_t view_matrix);
void transform_object(mat4_t view_matrix, mat4_t proj_matrix, object3d_t *obj3d, display_size_t display, vec3_t light_dir);
#endif