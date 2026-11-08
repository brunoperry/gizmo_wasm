#ifndef SKINNING_H
#define SKINNING_H

#include "skeleton.h"
#include "object.h"

// Allocates the skin of an object being created (between set_object_buffer
// and obj_done). Returns NULL on failure.
skin_t *skin_create(object3d_t *obj, int animator_id, int num_points, int influences, int method, int has_normals);

// Deforms the object's vertices (and normals) into its animator's current
// pose, if it changed. Updates the object's bounds and deform_version.
void skin_apply(object3d_t *obj);

#endif
