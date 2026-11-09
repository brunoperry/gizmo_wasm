#include "skinning.h"
#include "memory.h"

skin_t *skin_create(object3d_t *obj, int animator_id, int num_points, int influences, int method, int has_normals)
{
    animator_t *a = animator_get(animator_id);
    if (!obj || !a || num_points <= 0 || influences <= 0)
        return 0;
    const size_t corners = (size_t)obj->num_triangles * 3;
    skin_t *s = gz_alloc(sizeof(skin_t));
    if (!s)
        return 0;
    s->animator = a;
    s->method = method == SKIN_DUAL_QUATERNION ? SKIN_DUAL_QUATERNION : SKIN_LINEAR;
    s->num_points = num_points;
    s->influences = influences;
    s->bind_points = gz_alloc((size_t)num_points * 3 * sizeof(float));
    s->joints = gz_alloc((size_t)num_points * influences * sizeof(int32_t));
    s->weights = gz_alloc((size_t)num_points * influences * sizeof(float));
    s->corner_points = gz_alloc((corners ? corners : 1) * sizeof(int32_t));
    s->points = gz_alloc((size_t)num_points * 3 * sizeof(float));
    s->rotations = gz_alloc((size_t)num_points * 9 * sizeof(float));
    s->bind_normals = has_normals ? gz_alloc((corners ? corners : 1) * 3 * sizeof(float)) : 0;
    if (!s->bind_points || !s->joints || !s->weights || !s->corner_points || !s->points || !s->rotations ||
        (has_normals && !s->bind_normals))
        return 0;
    s->seen = 0; // animators start at version 0 and evaluate to 1+
    obj->skin = s;
    return s;
}

static inline void quat_rotate(const float *q, const float *v, float *out)
{
    // v + 2w (q x v) + 2 q x (q x v)
    const float w = q[0], x = q[1], y = q[2], z = q[3];
    const float cx = y * v[2] - z * v[1], cy = z * v[0] - x * v[2], cz = x * v[1] - y * v[0];
    out[0] = v[0] + 2.0f * (w * cx + y * cz - z * cy);
    out[1] = v[1] + 2.0f * (w * cy + z * cx - x * cz);
    out[2] = v[2] + 2.0f * (w * cz + x * cy - y * cx);
}

static inline void quat_to_mat3(const float *q, float *m)
{
    const float w = q[0], x = q[1], y = q[2], z = q[3];
    m[0] = 1 - 2 * (y * y + z * z), m[1] = 2 * (x * y - w * z), m[2] = 2 * (x * z + w * y);
    m[3] = 2 * (x * y + w * z), m[4] = 1 - 2 * (x * x + z * z), m[5] = 2 * (y * z - w * x);
    m[6] = 2 * (x * z - w * y), m[7] = 2 * (y * z + w * x), m[8] = 1 - 2 * (x * x + y * y);
}

// Linear blend skinning: the weighted sum of the joint matrices.
static void skin_linear(const skin_t *s, const animator_t *a, int p, float *pos, float *rot)
{
    float m[12] = {0};
    const int K = s->influences;
    for (int k = 0; k < K; k++)
    {
        const int j = s->joints[p * K + k];
        const float w = s->weights[p * K + k];
        if (j < 0 || w == 0.0f)
            continue;
        const mat4_t *jm = &a->skin[j];
        for (int r = 0; r < 3; r++)
            for (int c = 0; c < 4; c++)
                m[r * 4 + c] += w * jm->m[r][c];
    }
    const float *b = s->bind_points + p * 3;
    for (int r = 0; r < 3; r++)
    {
        pos[r] = m[r * 4] * b[0] + m[r * 4 + 1] * b[1] + m[r * 4 + 2] * b[2] + m[r * 4 + 3];
        rot[r * 3] = m[r * 4], rot[r * 3 + 1] = m[r * 4 + 1], rot[r * 3 + 2] = m[r * 4 + 2];
    }
}

// Dual quaternion skinning: blends rotations as rotations, so joints don't
// collapse when they twist (the "candy wrapper"). Scale is blended linearly.
static void skin_dual_quaternion(const skin_t *s, const animator_t *a, int p, float *pos, float *rot)
{
    float real[4] = {0}, dual[4] = {0}, scale[9] = {0};
    const float *pivot = 0;
    const int K = s->influences;
    for (int k = 0; k < K; k++)
    {
        const int j = s->joints[p * K + k];
        float w = s->weights[p * K + k];
        if (j < 0 || w == 0.0f)
            continue;
        const float *dq = a->dq + j * 17;
        // Keep every rotation on the same side as the first one.
        if (!pivot)
            pivot = dq;
        else if (pivot[0] * dq[0] + pivot[1] * dq[1] + pivot[2] * dq[2] + pivot[3] * dq[3] < 0.0f)
            w = -w;
        for (int i = 0; i < 4; i++)
        {
            real[i] += w * dq[i];
            dual[i] += w * dq[4 + i];
        }
        const float aw = w < 0.0f ? -w : w;
        for (int i = 0; i < 9; i++)
            scale[i] += aw * dq[8 + i];
    }
    const float *b = s->bind_points + p * 3;
    float len = sqrtf(real[0] * real[0] + real[1] * real[1] + real[2] * real[2] + real[3] * real[3]);
    if (!(len > 1e-12f))
    {
        // No influences: leave the point where the skeleton puts it at rest.
        const float *m = a->skel->to_object;
        for (int r = 0; r < 3; r++)
            pos[r] = m[r * 4] * b[0] + m[r * 4 + 1] * b[1] + m[r * 4 + 2] * b[2] + m[r * 4 + 3];
        for (int i = 0; i < 9; i++)
            rot[i] = (i % 4 == 0) ? 1.0f : 0.0f;
        return;
    }
    const float inv = 1.0f / len;
    for (int i = 0; i < 4; i++)
        real[i] *= inv, dual[i] *= inv;

    float scaled[3];
    for (int r = 0; r < 3; r++)
        scaled[r] = scale[r * 3] * b[0] + scale[r * 3 + 1] * b[1] + scale[r * 3 + 2] * b[2];
    quat_rotate(real, scaled, pos);
    // translation = 2 * (w_r * d_v - w_d * r_v + r_v x d_v)
    pos[0] += 2.0f * (real[0] * dual[1] - dual[0] * real[1] + real[2] * dual[3] - real[3] * dual[2]);
    pos[1] += 2.0f * (real[0] * dual[2] - dual[0] * real[2] + real[3] * dual[1] - real[1] * dual[3]);
    pos[2] += 2.0f * (real[0] * dual[3] - dual[0] * real[3] + real[1] * dual[2] - real[2] * dual[1]);
    quat_to_mat3(real, rot);
}

void skin_apply(object3d_t *obj)
{
    skin_t *s = obj->skin;
    if (!s || s->seen == s->animator->version)
        return;
    s->seen = s->animator->version;

    const animator_t *a = s->animator;
    for (int p = 0; p < s->num_points; p++)
    {
        if (s->method == SKIN_DUAL_QUATERNION)
            skin_dual_quaternion(s, a, p, s->points + p * 3, s->rotations + p * 9);
        else
            skin_linear(s, a, p, s->points + p * 3, s->rotations + p * 9);
    }

    // Triangle soup: every corner takes its point (and rotates its normal).
    const int corners = obj->num_triangles * 3;
    for (int c = 0; c < corners; c++)
    {
        const int p = s->corner_points[c];
        float *v = obj->vertices + c * 3;
        if (p < 0 || p >= s->num_points)
        {
            v[0] = v[1] = v[2] = 0.0f;
            continue;
        }
        const float *src = s->points + p * 3;
        v[0] = src[0], v[1] = src[1], v[2] = src[2];
        if (s->bind_normals && obj->has_normals)
        {
            const float *r = s->rotations + p * 9, *n = s->bind_normals + c * 3;
            float *out = obj->normals + c * 3;
            out[0] = r[0] * n[0] + r[1] * n[1] + r[2] * n[2];
            out[1] = r[3] * n[0] + r[4] * n[1] + r[5] * n[2];
            out[2] = r[6] * n[0] + r[7] * n[1] + r[8] * n[2];
        }
    }

    // Bounds follow the pose (shadow maps are fitted with them).
    for (int k = 0; k < 3; k++)
        obj->bounds_min[k] = obj->bounds_max[k] = s->num_points ? s->points[k] : 0.0f;
    for (int i = 0; i < s->num_points * 3; i += 3)
        for (int k = 0; k < 3; k++)
        {
            const float v = s->points[i + k];
            if (v < obj->bounds_min[k]) obj->bounds_min[k] = v;
            if (v > obj->bounds_max[k]) obj->bounds_max[k] = v;
        }
    obj->deform_version++;
}
