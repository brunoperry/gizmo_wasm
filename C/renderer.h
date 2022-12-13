#ifndef RENDERER_H
#define RENDERER_H

#include "object.h"
#include "display.h"
#include "light.h"
#include "camera.h"

void transform_object(camera_t camera, mat4_t view_matrix, object3d_t *obj3d, light_t *light, display_size_t display);
#endif