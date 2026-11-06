#ifndef SHADOW_PASS_H
#define SHADOW_PASS_H

#include "light3d.h"
#include "object.h"

// Renders the shadow map of every light that casts shadows and points its
// light_view_t.shadow at it (NULL for the others).
void shadows_render(lighting_t *lights, object3d_t *const *objects, int count);

#endif
