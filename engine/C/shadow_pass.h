#ifndef SHADOW_PASS_H
#define SHADOW_PASS_H

#include "light3d.h"
#include "object.h"
#include "camera3d.h"

// Renders the shadow map of every light that casts shadows and points its
// light_view_t.shadow at it (NULL for the others). The camera only matters
// to directional lights with a shadow distance (see light3d.h).
void shadows_render(lighting_t *lights, object3d_t *const *objects, int count, const camera_frame_t *frame);

// The scene changed: no cached map is valid, and maps allocated after `mark`
// are gone (see gz_release).
void shadows_release(uintptr_t mark);

#endif
