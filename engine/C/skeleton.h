#ifndef SKELETON_H
#define SKELETON_H

#include <stdint.h>
#include "matrix.h"

#define MAX_SKELETONS 32
#define MAX_ANIMATORS 128
#define FRAME_STRIDE 10 // per joint per frame: translation xyz, rotation wxyz, scale xyz

enum
{
    SKIN_LINEAR = 0,
    SKIN_DUAL_QUATERNION = 1,
};

// Shared, read-only data of one skeleton and its animation, written once by
// javascript (see WASM.upload_skeleton). Matrices: row-major, column vectors.
typedef struct
{
    int num_joints;
    int num_frames;
    int32_t *parents; // -1 for roots
    int32_t *order;   // evaluation order, parents before children
    float *inv_bind;  // 16 per joint: inverse bind pose (skeleton space)
    float *to_object; // 16: skeleton space -> object space
    float *frames;    // num_frames * num_joints * FRAME_STRIDE
} skeleton_t;

// One playing instance of a skeleton (e.g. one character). Javascript writes
// `state` every frame: [frame_a, frame_b, weight_b]. The pose is frame_a,
// blended towards frame_b by weight_b (crossfades). Frames can be fractional:
// they are interpolated.
typedef struct
{
    const skeleton_t *skel;
    float *state;
    float last[3];
    uint32_t version; // bumped whenever the pose changes
    mat4_t *global;   // per joint, skeleton space
    mat4_t *skin;     // per joint: to_object * global * inv_bind
    float *dq;        // per joint: real quat (4), dual quat (4), scale/shear 3x3 (9)
} animator_t;

// Skinning data of one object (see object3d_t.skin).
typedef struct skin_s
{
    animator_t *animator;
    int method; // SKIN_*
    int num_points;
    int influences;      // per point
    float *bind_points;  // 3 per point, skeleton space
    int32_t *joints;     // influences per point, -1 = none
    float *weights;      // influences per point
    int32_t *corner_points; // per triangle corner: point index (-1 = none)
    float *bind_normals; // 3 per corner, skeleton space; NULL = model has no normals
    float *points;       // scratch: skinned points (3 per point)
    float *rotations;    // scratch: 3x3 per point, to skin normals
    uint32_t seen;       // animator version last applied
} skin_t;

skeleton_t *skeleton_create(int num_joints, int num_frames);
skeleton_t *skeleton_get(int id);
int skeleton_count(void);

animator_t *animator_create(int skeleton_id);
animator_t *animator_get(int id);
int animator_count(void);
// Forgets the skeletons and animators allocated after `mark` (see gz_release).
void skeletons_release(uintptr_t mark);

// Recomputes the pose of every animator whose state changed.
void animators_update(void);

#endif
