// Skeletal animation: sampling baked animation (with interpolation and
// crossfades) and skinning (linear or dual quaternion).
#include "skeleton.h"
#include "skinning.h"
#include "memory.h"

static skeleton_t *skeletons[MAX_SKELETONS];
static int total_skeletons = 0;
static animator_t *animators[MAX_ANIMATORS];
static int total_animators = 0;

skeleton_t *skeleton_create(int num_joints, int num_frames)
{
    if (total_skeletons >= MAX_SKELETONS || num_joints <= 0 || num_frames <= 0)
        return 0;
    skeleton_t *s = gz_alloc(sizeof(skeleton_t));
    if (!s)
        return 0;
    s->num_joints = num_joints;
    s->num_frames = num_frames;
    s->parents = gz_alloc((size_t)num_joints * sizeof(int32_t));
    s->order = gz_alloc((size_t)num_joints * sizeof(int32_t));
    s->inv_bind = gz_alloc((size_t)num_joints * 16 * sizeof(float));
    s->to_object = gz_alloc(16 * sizeof(float));
    s->frames = gz_alloc((size_t)num_frames * num_joints * FRAME_STRIDE * sizeof(float));
    if (!s->parents || !s->order || !s->inv_bind || !s->to_object || !s->frames)
        return 0;
    skeletons[total_skeletons++] = s;
    return s;
}

skeleton_t *skeleton_get(int id) { return id >= 0 && id < total_skeletons ? skeletons[id] : 0; }
int skeleton_count(void) { return total_skeletons; }

animator_t *animator_create(int skeleton_id)
{
    const skeleton_t *s = skeleton_get(skeleton_id);
    if (!s || total_animators >= MAX_ANIMATORS)
        return 0;
    animator_t *a = gz_alloc(sizeof(animator_t));
    if (!a)
        return 0;
    a->skel = s;
    a->state = gz_alloc(4 * sizeof(float));
    a->global = gz_alloc((size_t)s->num_joints * sizeof(mat4_t));
    a->skin = gz_alloc((size_t)s->num_joints * sizeof(mat4_t));
    a->dq = gz_alloc((size_t)s->num_joints * 17 * sizeof(float));
    if (!a->state || !a->global || !a->skin || !a->dq)
        return 0;
    a->last[0] = -1.0f; // force the first evaluation
    animators[total_animators++] = a;
    return a;
}

animator_t *animator_get(int id) { return id >= 0 && id < total_animators ? animators[id] : 0; }
int animator_count(void) { return total_animators; }

/////////
// Sampling
/////////

typedef struct
{
    float t[3], q[4], s[3]; // q: w, x, y, z
} trs_t;

// a + (b - a) * w, quaternions by normalized lerp along the short arc.
static inline void trs_lerp(const float *a, const float *b, float w, trs_t *o)
{
    for (int i = 0; i < 3; i++)
    {
        o->t[i] = a[i] + (b[i] - a[i]) * w;
        o->s[i] = a[7 + i] + (b[7 + i] - a[7 + i]) * w;
    }
    float dot = a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6];
    float sign = dot < 0.0f ? -1.0f : 1.0f;
    float len = 0.0f;
    for (int i = 0; i < 4; i++)
    {
        o->q[i] = a[3 + i] + (sign * b[3 + i] - a[3 + i]) * w;
        len += o->q[i] * o->q[i];
    }
    float inv = len > 1e-20f ? 1.0f / sqrtf(len) : 0.0f;
    for (int i = 0; i < 4; i++)
        o->q[i] *= inv;
}

static inline void sample(const skeleton_t *s, float frame, int joint, trs_t *out)
{
    const int last = s->num_frames - 1;
    if (!(frame > 0.0f)) frame = 0.0f; // also NaN
    if (frame > (float)last) frame = (float)last;
    int f0 = (int)frame;
    int f1 = f0 < last ? f0 + 1 : f0;
    const float *a = s->frames + ((size_t)f0 * s->num_joints + joint) * FRAME_STRIDE;
    const float *b = s->frames + ((size_t)f1 * s->num_joints + joint) * FRAME_STRIDE;
    trs_lerp(a, b, frame - (float)f0, out);
}

static inline mat4_t trs_matrix(const trs_t *p)
{
    const float w = p->q[0], x = p->q[1], y = p->q[2], z = p->q[3];
    return (mat4_t){{{(1 - 2 * (y * y + z * z)) * p->s[0], 2 * (x * y - w * z) * p->s[1], 2 * (x * z + w * y) * p->s[2], p->t[0]},
                     {2 * (x * y + w * z) * p->s[0], (1 - 2 * (x * x + z * z)) * p->s[1], 2 * (y * z - w * x) * p->s[2], p->t[1]},
                     {2 * (x * z - w * y) * p->s[0], 2 * (y * z + w * x) * p->s[1], (1 - 2 * (x * x + y * y)) * p->s[2], p->t[2]},
                     {0, 0, 0, 1}}};
}

static inline mat4_t mat4_from_floats(const float *f)
{
    mat4_t m;
    for (int i = 0; i < 16; i++)
        m.m[i / 4][i % 4] = f[i];
    return m;
}

// Rotation part of an orthonormal 3x3 -> unit quaternion (w, x, y, z).
static void quat_from_rotation(const float r[3][3], float q[4])
{
    float trace = r[0][0] + r[1][1] + r[2][2];
    if (trace > 0.0f)
    {
        float s = 0.5f / sqrtf(trace + 1.0f);
        q[0] = 0.25f / s, q[1] = (r[2][1] - r[1][2]) * s, q[2] = (r[0][2] - r[2][0]) * s, q[3] = (r[1][0] - r[0][1]) * s;
    }
    else if (r[0][0] > r[1][1] && r[0][0] > r[2][2])
    {
        float s = 2.0f * sqrtf(1.0f + r[0][0] - r[1][1] - r[2][2]);
        q[0] = (r[2][1] - r[1][2]) / s, q[1] = 0.25f * s, q[2] = (r[0][1] + r[1][0]) / s, q[3] = (r[0][2] + r[2][0]) / s;
    }
    else if (r[1][1] > r[2][2])
    {
        float s = 2.0f * sqrtf(1.0f + r[1][1] - r[0][0] - r[2][2]);
        q[0] = (r[0][2] - r[2][0]) / s, q[1] = (r[0][1] + r[1][0]) / s, q[2] = 0.25f * s, q[3] = (r[1][2] + r[2][1]) / s;
    }
    else
    {
        float s = 2.0f * sqrtf(1.0f + r[2][2] - r[0][0] - r[1][1]);
        q[0] = (r[1][0] - r[0][1]) / s, q[1] = (r[0][2] + r[2][0]) / s, q[2] = (r[1][2] + r[2][1]) / s, q[3] = 0.25f * s;
    }
    float len = sqrtf(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    for (int i = 0; i < 4; i++)
        q[i] /= len > 0.0f ? len : 1.0f;
}

// Skinning matrix -> rigid part as a dual quaternion + scale/shear 3x3
// (M = [R | t] * S, so the scale is applied to the point first).
static void to_dual_quaternion(const mat4_t *m, float *out)
{
    float r[3][3], scale[3];
    for (int c = 0; c < 3; c++)
    {
        scale[c] = sqrtf(m->m[0][c] * m->m[0][c] + m->m[1][c] * m->m[1][c] + m->m[2][c] * m->m[2][c]);
        float inv = scale[c] > 1e-12f ? 1.0f / scale[c] : 0.0f;
        for (int i = 0; i < 3; i++)
            r[i][c] = m->m[i][c] * inv;
    }
    float *q = out, *d = out + 4, *s = out + 8;
    quat_from_rotation(r, q);
    // S = R^T * M3
    for (int i = 0; i < 3; i++)
        for (int j = 0; j < 3; j++)
            s[i * 3 + j] = r[0][i] * m->m[0][j] + r[1][i] * m->m[1][j] + r[2][i] * m->m[2][j];
    // dual = 0.5 * (0, t) * q
    const float tx = m->m[0][3], ty = m->m[1][3], tz = m->m[2][3];
    d[0] = -0.5f * (tx * q[1] + ty * q[2] + tz * q[3]);
    d[1] = 0.5f * (tx * q[0] + ty * q[3] - tz * q[2]);
    d[2] = 0.5f * (-tx * q[3] + ty * q[0] + tz * q[1]);
    d[3] = 0.5f * (tx * q[2] - ty * q[1] + tz * q[0]);
}

static void animator_evaluate(animator_t *a)
{
    const float fa = a->state[0], fb = a->state[1];
    float w = a->state[2];
    if (fa == a->last[0] && fb == a->last[1] && w == a->last[2])
        return;
    a->last[0] = fa, a->last[1] = fb, a->last[2] = w;
    a->version++;

    if (!(w > 0.0f)) w = 0.0f;
    if (w > 1.0f) w = 1.0f;
    const skeleton_t *s = a->skel;
    const mat4_t to_object = mat4_from_floats(s->to_object);
    for (int k = 0; k < s->num_joints; k++)
    {
        const int j = s->order[k];
        if (j < 0 || j >= s->num_joints)
            continue;
        trs_t pose;
        sample(s, fa, j, &pose);
        if (w > 0.0f)
        {
            trs_t other, blended;
            sample(s, fb, j, &other);
            trs_lerp((const float *)&pose, (const float *)&other, w, &blended); // same layout as a frame
            pose = blended;
        }
        const mat4_t local = trs_matrix(&pose);
        const int parent = s->parents[j];
        a->global[j] = parent >= 0 && parent < s->num_joints ? mat4_mul_mat4(a->global[parent], local) : local;
    }
    for (int j = 0; j < s->num_joints; j++)
    {
        a->skin[j] = mat4_mul_mat4(to_object, mat4_mul_mat4(a->global[j], mat4_from_floats(s->inv_bind + j * 16)));
        to_dual_quaternion(&a->skin[j], a->dq + j * 17);
    }
}

void animators_update(void)
{
    for (int i = 0; i < total_animators; i++)
        animator_evaluate(animators[i]);
}
