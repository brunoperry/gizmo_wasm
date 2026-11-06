#ifndef RENDERER_H
#define RENDERER_H

#include "camera3d.h"
#include "light3d.h"
#include "object.h"

// Transforms, culls, clips, projects, lights and rasterizes one object.
// lighting: LIGHTING_TRIANGLE / VERTEX / PIXEL.
// Returns the number of triangles drawn.
int render_object(const object3d_t *obj, const camera_frame_t *frame, const lighting_t *lights,
                  int render_mode, int lighting);

// T * R * S, as used for rendering.
mat4_t object_model_matrix(const object3d_t *obj);

// Draws every light as a wireframe icon (on top of the scene).
void render_light_gizmos(const lighting_t *lights, const camera_frame_t *frame);

#endif
