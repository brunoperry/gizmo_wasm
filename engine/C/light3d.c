#include "light3d.h"

float *light_data = 0;

static uint32_t gizmo_color(vec3_t c)
{
    // Brightest channel to full, so dim lights stay visible.
    float m = c.x > c.y ? c.x : c.y;
    if (c.z > m) m = c.z;
    if (!(m > 1e-6f))
        return 0xFFFFFFFFu;
    uint32_t r = (uint32_t)(c.x / m * 255.0f + 0.5f);
    uint32_t g = (uint32_t)(c.y / m * 255.0f + 0.5f);
    uint32_t b = (uint32_t)(c.z / m * 255.0f + 0.5f);
    return 0xFF000000u | (b << 16) | (g << 8) | r; // RGBA bytes in memory
}

void lighting_frame(lighting_t *out, const mat4_t *view)
{
    out->view_inv = mat4_rigid_inverse(view);
    out->count = 0;
    out->has_local = 0;
    out->ambient = vec3_new(0, 0, 0);
    for (int i = 0; i < MAX_LIGHTS; i++)
        out->all[i] = (unsigned char)i;
    if (!light_data)
        return;

    out->ambient = vec3_new(light_data[1], light_data[2], light_data[3]);
    int count = (int)light_data[0];
    if (count < 0) count = 0;
    if (count > MAX_LIGHTS) count = MAX_LIGHTS;

    for (int i = 0; i < count; i++)
    {
        const float *s = light_data + LIGHT_HEADER + i * LIGHT_STRIDE;
        light_view_t *l = &out->lights[out->count];
        l->type = (int)s[0];
        if (l->type < LIGHT_DIRECTIONAL || l->type > LIGHT_SPOT)
            continue;

        vec3_t color = vec3_new(s[5], s[6], s[7]);
        l->color = vec3_mul(color, s[1]);
        l->gizmo_color = gizmo_color(color);
        l->range = s[2];
        l->inv_range_sq = s[2] > 0.0f ? 1.0f / (s[2] * s[2]) : 0.0f;
        l->cos_inner = s[3];
        l->cos_outer = s[4];
        float cone = s[3] - s[4];
        l->inv_cone = 1.0f / (cone > 1e-4f ? cone : 1e-4f);
        l->pos_world = vec3_new(s[8], s[9], s[10]);
        l->dir_world = vec3_normalize_or(vec3_new(s[11], s[12], s[13]), vec3_new(0, -1, 0));
        l->casts_shadows = s[14] != 0.0f;
        l->shadow_distance = s[15];
        l->shadow = 0;
        l->pos = mat4_mul_point(view, s[8], s[9], s[10]);
        l->dir = vec3_normalize_or(mat4_mul_dir(view, vec3_new(s[11], s[12], s[13])), vec3_new(0, -1, 0));
        if (l->type != LIGHT_DIRECTIONAL)
            out->has_local = 1;
        out->count++;
    }
}

int lighting_select(const lighting_t *lt, vec3_t center, float radius, unsigned char *active)
{
    int n = 0;
    for (int i = 0; i < lt->count; i++)
    {
        const light_view_t *l = &lt->lights[i];
        if (l->type != LIGHT_DIRECTIONAL && l->inv_range_sq > 0.0f)
        {
            float reach = l->range + radius;
            vec3_t d = vec3_sub(l->pos, center);
            if (vec3_dot(d, d) >= reach * reach)
                continue;
        }
        active[n++] = (unsigned char)i;
    }
    return n;
}
