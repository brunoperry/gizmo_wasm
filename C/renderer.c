#include "renderer.h"
#include "display.h"
#include "raster.h"
#include "texture.h"

#define SHADED_COLOR 0xffa5a5a5u
#define WIRE_COLOR 0xff640000u
#define MIN_LIGHT 0.3f

// 3 vertices + at most 1 extra per clipping plane.
#define MAX_CLIP_VERTS 12

// View-space vertex used while clipping. u, v are already in texels.
typedef struct
{
    float x, y, z, u, v;
} cvert_t;

#define NUM_PLANES 6

// Signed distance (unnormalized) to each frustum plane; >= 0 is inside.
// The side planes come straight from the projection, so clipping and
// projection can never disagree.
static inline float plane_dist(int plane, const cvert_t *p, const camera_frame_t *f)
{
    switch (plane)
    {
    case 0: return p->z + p->x * f->proj_x; // left
    case 1: return p->z - p->x * f->proj_x; // right
    case 2: return p->z + p->y * f->proj_y; // bottom
    case 3: return p->z - p->y * f->proj_y; // top
    case 4: return p->z - f->z_near;        // near
    default: return f->z_far - p->z;        // far
    }
}

static inline unsigned outcode(const cvert_t *p, const camera_frame_t *f)
{
    unsigned code = 0;
    for (int plane = 0; plane < NUM_PLANES; plane++)
        if (plane_dist(plane, p, f) < 0)
            code |= 1u << plane;
    return code;
}

// Sutherland-Hodgman against a single plane. Returns the new vertex count.
static int clip_against_plane(const cvert_t *in, int count, cvert_t *out, int plane, const camera_frame_t *f)
{
    int n = 0;
    const cvert_t *prev = &in[count - 1];
    float d_prev = plane_dist(plane, prev, f);

    for (int i = 0; i < count; i++)
    {
        const cvert_t *cur = &in[i];
        float d_cur = plane_dist(plane, cur, f);

        if ((d_prev >= 0) != (d_cur >= 0))
        {
            float t = d_prev / (d_prev - d_cur);
            out[n++] = (cvert_t){
                prev->x + (cur->x - prev->x) * t,
                prev->y + (cur->y - prev->y) * t,
                prev->z + (cur->z - prev->z) * t,
                prev->u + (cur->u - prev->u) * t,
                prev->v + (cur->v - prev->v) * t};
        }
        if (d_cur >= 0)
            out[n++] = *cur;

        prev = cur;
        d_prev = d_cur;
    }
    return n;
}

int render_object(const object3d_t *obj, const camera_frame_t *f, vec3_t light_view, int mode)
{
    mat4_t model = mat4_make_translation(vec3_from_ptr(obj->position));
    model = mat4_mul_mat4(model, mat4_make_rotation(vec3_from_ptr(obj->rotation)));
    model = mat4_mul_mat4(model, mat4_make_scale(vec3_from_ptr(obj->scale)));
    // Single model-view matrix: one transform per vertex instead of two.
    const mat4_t mv = mat4_mul_mat4(f->view, model);

    const texture_t *tex = texture_get(obj->texture_id);
    if (mode == RENDER_TEXTURED && !tex)
        mode = RENDER_SHADED;
    const int textured = mode == RENDER_TEXTURED;
    const float tex_w = textured ? (float)tex->width : 0.0f;
    const float tex_h = textured ? (float)tex->height : 0.0f;

    const float half_w = display.width * 0.5f, half_h = display.height * 0.5f;
    const float sx_scale = half_w * f->proj_x, sy_scale = half_h * f->proj_y;

    int drawn = 0;
    const float *vp = obj->vertices;
    const float *uvp = obj->uvs;

    for (int t = 0; t < obj->num_triangles; t++, vp += 9, uvp += 6)
    {
        vec3_t a = mat4_mul_point(&mv, vp[0], vp[1], vp[2]);
        vec3_t b = mat4_mul_point(&mv, vp[3], vp[4], vp[5]);
        vec3_t c = mat4_mul_point(&mv, vp[6], vp[7], vp[8]);

        // View space is mirrored relative to the (right-handed) world, so a
        // counter-clockwise front face has its cross product pointing away
        // from the eye: visible <=> dot(normal, a) > 0.
        vec3_t normal = vec3_cross(vec3_sub(b, a), vec3_sub(c, a));
        if (vec3_dot(normal, a) <= 0)
            continue;

        cvert_t poly_a[MAX_CLIP_VERTS], poly_b[MAX_CLIP_VERTS];
        poly_a[0] = (cvert_t){a.x, a.y, a.z, 0, 0};
        poly_a[1] = (cvert_t){b.x, b.y, b.z, 0, 0};
        poly_a[2] = (cvert_t){c.x, c.y, c.z, 0, 0};

        unsigned oc0 = outcode(&poly_a[0], f);
        unsigned oc1 = outcode(&poly_a[1], f);
        unsigned oc2 = outcode(&poly_a[2], f);
        if (oc0 & oc1 & oc2) // completely outside one plane
            continue;

        if (textured)
            for (int j = 0; j < 3; j++)
            {
                poly_a[j].u = uvp[j * 2] * tex_w;
                poly_a[j].v = (1.0f - uvp[j * 2 + 1]) * tex_h; // V grows downwards in images
            }

        // Only clip against the planes the triangle actually crosses.
        cvert_t *poly = poly_a, *spare = poly_b;
        int count = 3;
        unsigned crossing = oc0 | oc1 | oc2;
        for (int plane = 0; plane < NUM_PLANES && count >= 3; plane++)
        {
            if (!(crossing & (1u << plane)))
                continue;
            count = clip_against_plane(poly, count, spare, plane, f);
            cvert_t *tmp = poly;
            poly = spare;
            spare = tmp;
        }
        if (count < 3)
            continue;

        svert_t sv[MAX_CLIP_VERTS];
        for (int j = 0; j < count; j++)
        {
            float iw = 1.0f / poly[j].z; // z >= z_near > 0 after clipping
            sv[j].x = half_w + poly[j].x * iw * sx_scale;
            sv[j].y = half_h - poly[j].y * iw * sy_scale;
            sv[j].iw = iw;
            sv[j].u = poly[j].u * iw;
            sv[j].v = poly[j].v * iw;
        }

        if (mode == RENDER_WIRED)
        {
            for (int j = 0; j < count; j++)
            {
                const svert_t *p0 = &sv[j], *p1 = &sv[(j + 1) % count];
                raster_line(p0->x, p0->y, p1->x, p1->y, WIRE_COLOR);
            }
            drawn += count - 2;
            continue;
        }

        float light = vec3_dot(normal, light_view) / vec3_length(normal);
        if (!(light > MIN_LIGHT)) light = MIN_LIGHT;
        if (light > 1.0f) light = 1.0f;
        uint32_t shade = (uint32_t)(light * 256.0f);

        for (int j = 1; j < count - 1; j++)
        {
            if (textured)
                raster_textured(&sv[0], &sv[j], &sv[j + 1], tex, shade);
            else
                raster_flat(&sv[0], &sv[j], &sv[j + 1], color_shade(SHADED_COLOR, shade));
        }
        drawn += count - 2;
    }
    return drawn;
}
