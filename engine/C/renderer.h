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

// 0 when the object's bounding box is entirely outside the view frustum
// (or it has no triangles): render_object would draw nothing.
int object_visible(const object3d_t *obj, const camera_frame_t *frame);

// T * R * S, as used for rendering.
mat4_t object_model_matrix(const object3d_t *obj);

// Draws every light as a wireframe icon (on top of the scene).
void render_light_gizmos(const lighting_t *lights, const camera_frame_t *frame);

// Grid on the ground plane (world y = 0) around the camera, hidden behind
// what was already drawn (it writes no depth).
void render_grid(const camera_frame_t *frame);

#endif
