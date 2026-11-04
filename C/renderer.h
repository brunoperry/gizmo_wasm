#ifndef RENDERER_H
#define RENDERER_H

#include "camera3d.h"
#include "object.h"

// Transforms, culls, clips, projects and rasterizes one object.
// light_view: normalized light direction in view space.
// Returns the number of triangles drawn.
int render_object(const object3d_t *obj, const camera_frame_t *frame, vec3_t light_view, int render_mode);

#endif
