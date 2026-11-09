#include <stddef.h>
#include "renderer.h"
#include "display.h"
#include "raster.h"
#include "texture.h"

#define SHADED_COLOR 0xffa5a5a5u
#define WIRE_COLOR 0xff640000u

// Light gizmos keep a constant size on screen: GIZMO_SIZE * distance.
#define GIZMO_SIZE 0.04f

// 3 vertices + at most 1 extra per clipping plane.
#define MAX_CLIP_VERTS 12

// View-space vertex used while clipping. u, v are already in texels;
// a[] holds the lighting attributes (see svert_t).
typedef struct
{
    float x, y, z, u, v;
    float a[RASTER_MAX_ATTRS];
} cvert_t;

#define NUM_PLANES 6

// Signed distance (unnormalized) to each frustum plane; >= 0 is inside.
// The side planes come straight from the projection, so clipping and
// projection can never disagree.
static inline float plane_dist(int plane, float x, float y, float z, const camera_frame_t *f)
{
    switch (plane)
    {
    case 0: return z + x * f->proj_x; // left
    case 1: return z - x * f->proj_x; // right
    case 2: return z + y * f->proj_y; // bottom
    case 3: return z - y * f->proj_y; // top
    case 4: return z - f->z_near;     // near
    default: return f->z_far - z;     // far
    }
}

static inline unsigned outcode(const cvert_t *p, const camera_frame_t *f)
{
    unsigned code = 0;
    for (int plane = 0; plane < NUM_PLANES; plane++)
        if (plane_dist(plane, p->x, p->y, p->z, f) < 0)
            code |= 1u << plane;
    return code;
}

// Sutherland-Hodgman against a single plane. Returns the new vertex count.
static int clip_against_plane(const cvert_t *in, int count, cvert_t *out, int plane,
                              const camera_frame_t *f, int nattr)
{
    int n = 0;
    const cvert_t *prev = &in[count - 1];
    float d_prev = plane_dist(plane, prev->x, prev->y, prev->z, f);

    for (int i = 0; i < count; i++)
    {
        const cvert_t *cur = &in[i];
        float d_cur = plane_dist(plane, cur->x, cur->y, cur->z, f);

        if ((d_prev >= 0) != (d_cur >= 0))
        {
            float t = d_prev / (d_prev - d_cur);
            cvert_t *o = &out[n++];
            o->x = prev->x + (cur->x - prev->x) * t;
            o->y = prev->y + (cur->y - prev->y) * t;
            o->z = prev->z + (cur->z - prev->z) * t;
            o->u = prev->u + (cur->u - prev->u) * t;
            o->v = prev->v + (cur->v - prev->v) * t;
            for (int k = 0; k < nattr; k++)
                o->a[k] = prev->a[k] + (cur->a[k] - prev->a[k]) * t;
        }
        if (d_cur >= 0)
            out[n++] = *cur;

        prev = cur;
        d_prev = d_cur;
    }
    return n;
}

static inline float min1(float v) { return v < 1.0f ? v : 1.0f; }

mat4_t object_model_matrix(const object3d_t *obj)
{
    return mat4_mul_mat4(mat4_make_translation(vec3_from_ptr(obj->position)),
                         mat4_mul_mat4(mat4_make_rotation(vec3_from_ptr(obj->rotation)),
                                       mat4_make_scale(vec3_from_ptr(obj->scale))));
}

int object_visible(const object3d_t *obj, const camera_frame_t *f)
{
    if (!obj->num_triangles)
        return 0;
    const mat4_t mv = mat4_mul_mat4(f->view, object_model_matrix(obj));
    const float *lo = obj->bounds_min, *hi = obj->bounds_max;
    unsigned all = ~0u;
    for (int k = 0; k < 8 && all; k++)
    {
        vec3_t q = mat4_mul_point(&mv, (k & 1) ? hi[0] : lo[0], (k & 2) ? hi[1] : lo[1], (k & 4) ? hi[2] : lo[2]);
        cvert_t p;
        p.x = q.x, p.y = q.y, p.z = q.z;
        all &= outcode(&p, f);
    }
    return all == 0;
}

int render_object(const object3d_t *obj, const camera_frame_t *f, const lighting_t *lt, int mode, int lighting)
{
    const vec3_t scale = vec3_from_ptr(obj->scale);
    const mat4_t rotation = mat4_make_rotation(vec3_from_ptr(obj->rotation));
    const mat4_t model = object_model_matrix(obj);
    // Single model-view matrix: one transform per vertex instead of two.
    const mat4_t mv = mat4_mul_mat4(f->view, model);

    // Normals use the inverse transpose of the model's linear part, R * S^-1.
    const vec3_t inv_scale = vec3_new(scale.x != 0.0f ? 1.0f / scale.x : 1.0f,
                                      scale.y != 0.0f ? 1.0f / scale.y : 1.0f,
                                      scale.z != 0.0f ? 1.0f / scale.z : 1.0f);
    const mat4_t normal_mv = mat4_mul_mat4(f->view, mat4_mul_mat4(rotation, mat4_make_scale(inv_scale)));

    const texture_t *tex = texture_get(obj->texture_id);
    if (mode == RENDER_TEXTURED && !tex)
        mode = RENDER_SHADED;
    const int textured = mode == RENDER_TEXTURED;
    const float tex_w = textured ? (float)tex->width : 0.0f;
    const float tex_h = textured ? (float)tex->height : 0.0f;

    if (lighting < LIGHTING_TRIANGLE || lighting > LIGHTING_PIXEL)
        lighting = LIGHTING_TRIANGLE;
    const int nattr = mode == RENDER_WIRED ? 0
                      : lighting == LIGHTING_VERTEX ? 3
                      : lighting == LIGHTING_PIXEL ? 6
                                                   : 0;

    raster_params_t params = {0};
    params.tex = textured ? tex : 0;
    params.color = SHADED_COLOR;
    params.lighting = lighting;
    params.lights = lt;

    const float half_w = display.width * 0.5f, half_h = display.height * 0.5f;
    const float sx_scale = half_w * f->proj_x, sy_scale = half_h * f->proj_y;

    int drawn = 0;
    const float *vp = obj->vertices;
    const float *uvp = obj->uvs;
    const float *np = obj->has_normals ? obj->normals : 0;

    for (int t = 0; t < obj->num_triangles; t++, vp += 9, uvp += 6, np += np ? 9 : 0)
    {
        vec3_t a = mat4_mul_point(&mv, vp[0], vp[1], vp[2]);
        vec3_t b = mat4_mul_point(&mv, vp[3], vp[4], vp[5]);
        vec3_t c = mat4_mul_point(&mv, vp[6], vp[7], vp[8]);

        // View space is mirrored relative to the (right-handed) world, so a
        // counter-clockwise front face has its cross product pointing away
        // from the eye: visible <=> dot(cross, a) > 0. The outward normal is
        // therefore -cross.
        vec3_t cross = vec3_cross(vec3_sub(b, a), vec3_sub(c, a));
        if (vec3_dot(cross, a) <= 0)
            continue;

        cvert_t poly_a[MAX_CLIP_VERTS], poly_b[MAX_CLIP_VERTS];
        poly_a[0].x = a.x, poly_a[0].y = a.y, poly_a[0].z = a.z;
        poly_a[1].x = b.x, poly_a[1].y = b.y, poly_a[1].z = b.z;
        poly_a[2].x = c.x, poly_a[2].y = c.y, poly_a[2].z = c.z;

        unsigned oc0 = outcode(&poly_a[0], f);
        unsigned oc1 = outcode(&poly_a[1], f);
        unsigned oc2 = outcode(&poly_a[2], f);
        if (oc0 & oc1 & oc2) // completely outside one plane
            continue;

        for (int j = 0; j < 3; j++)
        {
            poly_a[j].u = textured ? uvp[j * 2] * tex_w : 0.0f;
            poly_a[j].v = textured ? (1.0f - uvp[j * 2 + 1]) * tex_h : 0.0f; // V grows downwards in images
        }

        unsigned char selected[MAX_LIGHTS];
        if (mode != RENDER_WIRED)
        {
            const vec3_t face_n = vec3_normalize_or(vec3_mul(cross, -1.0f), vec3_new(0, 0, -1));
            const vec3_t center = vec3_mul(vec3_add(vec3_add(a, b), c), 1.0f / 3.0f);
            // Only point/spot lights can be out of reach: skip the test otherwise.
            const unsigned char *active = lt->all;
            int num_active = lt->count;
            if (lt->has_local)
            {
                float r_sq = vec3_dot(vec3_sub(a, center), vec3_sub(a, center));
                float r_b = vec3_dot(vec3_sub(b, center), vec3_sub(b, center));
                float r_c = vec3_dot(vec3_sub(c, center), vec3_sub(c, center));
                if (r_b > r_sq) r_sq = r_b;
                if (r_c > r_sq) r_sq = r_c;
                num_active = lighting_select(lt, center, sqrtf(r_sq), selected);
                active = selected;
            }

            if (lighting == LIGHTING_TRIANGLE)
            {
                vec3_t l = lighting_eval(lt, active, num_active, center, face_n);
                params.light[0] = light_to_int(l.x);
                params.light[1] = light_to_int(l.y);
                params.light[2] = light_to_int(l.z);
            }
            else
            {
                params.active = active;
                params.active_count = num_active;
                const vec3_t pos[3] = {a, b, c};
                for (int j = 0; j < 3; j++)
                {
                    vec3_t n = face_n;
                    if (np)
                        n = vec3_normalize_or(mat4_mul_dir(&normal_mv, vec3_from_ptr(np + j * 3)), face_n);
                    if (lighting == LIGHTING_VERTEX)
                    {
                        vec3_t l = lighting_eval(lt, active, num_active, pos[j], n);
                        poly_a[j].a[0] = min1(l.x);
                        poly_a[j].a[1] = min1(l.y);
                        poly_a[j].a[2] = min1(l.z);
                    }
                    else
                    {
                        poly_a[j].a[0] = pos[j].x, poly_a[j].a[1] = pos[j].y, poly_a[j].a[2] = pos[j].z;
                        poly_a[j].a[3] = n.x, poly_a[j].a[4] = n.y, poly_a[j].a[5] = n.z;
                    }
                }
            }
        }

        // Only clip against the planes the triangle actually crosses.
        cvert_t *poly = poly_a, *spare = poly_b;
        int count = 3;
        unsigned crossing = oc0 | oc1 | oc2;
        for (int plane = 0; plane < NUM_PLANES && count >= 3; plane++)
        {
            if (!(crossing & (1u << plane)))
                continue;
            count = clip_against_plane(poly, count, spare, plane, f, nattr);
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
            for (int k = 0; k < nattr; k++)
                sv[j].a[k] = poly[j].a[k] * iw;
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

        for (int j = 1; j < count - 1; j++)
            raster_triangle(&sv[0], &sv[j], &sv[j + 1], &params);
        drawn += count - 2;
    }
    return drawn;
}

/////////
// Lines in view space: light gizmos (on top of everything) and the grid.
/////////

// Depth-tested, fading line (see raster_line_depth), invisible past max_z.
typedef struct
{
    float scale, offset;
    float max_z;
} line_fade_t;

// Clips a view-space segment against the frustum, projects it and draws it.
// fade: NULL draws on top of everything.
static void view_line(vec3_t p0, vec3_t p1, uint32_t color, const line_fade_t *fade, const camera_frame_t *f)
{
    float t0 = 0.0f, t1 = 1.0f;
    for (int plane = 0; plane < NUM_PLANES; plane++)
    {
        float d0 = plane_dist(plane, p0.x, p0.y, p0.z, f);
        float d1 = plane_dist(plane, p1.x, p1.y, p1.z, f);
        if (d0 < 0 && d1 < 0)
            return;
        if (d0 < 0)
        {
            float t = d0 / (d0 - d1);
            if (t > t0) t0 = t;
        }
        else if (d1 < 0)
        {
            float t = d0 / (d0 - d1);
            if (t < t1) t1 = t;
        }
    }
    if (fade) // nothing to draw where it has faded out
    {
        float d0 = fade->max_z - p0.z, d1 = fade->max_z - p1.z;
        if (d0 < 0 && d1 < 0)
            return;
        if (d0 < 0 || d1 < 0)
        {
            float t = d0 / (d0 - d1);
            if (d0 < 0 && t > t0) t0 = t;
            if (d1 < 0 && t < t1) t1 = t;
        }
    }
    if (t0 > t1)
        return;

    vec3_t d = vec3_sub(p1, p0);
    vec3_t q0 = vec3_add(p0, vec3_mul(d, t0));
    vec3_t q1 = vec3_add(p0, vec3_mul(d, t1));
    const float half_w = display.width * 0.5f, half_h = display.height * 0.5f;
    const float sx_scale = half_w * f->proj_x, sy_scale = half_h * f->proj_y;
    const float iw0 = 1.0f / q0.z, iw1 = 1.0f / q1.z;
    const float x0 = half_w + q0.x * iw0 * sx_scale, y0 = half_h - q0.y * iw0 * sy_scale;
    const float x1 = half_w + q1.x * iw1 * sx_scale, y1 = half_h - q1.y * iw1 * sy_scale;
    if (fade)
        raster_line_depth(x0, y0, iw0, x1, y1, iw1, color, fade->scale, fade->offset);
    else
        raster_line(x0, y0, x1, y1, color);
}

static void gizmo_line(vec3_t p0, vec3_t p1, uint32_t color, const camera_frame_t *f)
{
    view_line(p0, p1, color, NULL, f);
}

// Grid on the ground (world y = 0): lines one unit apart, GRID_HALF each side
// of the camera, following it in whole steps so it looks endless. It fades out
// between GRID_FADE_NEAR and GRID_FADE_FAR view depth, which hides both its
// edge and the jagged mess of far lines. Every GRID_MAJOR-th line is brighter;
// the X and Z axes are red and blue.
#define GRID_HALF 25
#define GRID_FADE_NEAR 6.0f
#define GRID_FADE_FAR 24.0f
#define GRID_MAJOR 10
#define GRID_COLOR 0xff6e6e6eu
#define GRID_MAJOR_COLOR 0xff9a9a9au
#define GRID_X_AXIS_COLOR 0xff3c3cc8u // red
#define GRID_Z_AXIS_COLOR 0xffc8783cu // blue

void render_grid(const camera_frame_t *f)
{
    // Opacity is linear in 1 / depth: 1 at GRID_FADE_NEAR, 0 at GRID_FADE_FAR.
    const float iw_near = 1.0f / GRID_FADE_NEAR, iw_far = 1.0f / GRID_FADE_FAR;
    const line_fade_t fade = {1.0f / (iw_near - iw_far), -iw_far / (iw_near - iw_far), GRID_FADE_FAR};

    const int cx = (int)floorf(camera3d.position[0] + 0.5f);
    const int cz = (int)floorf(camera3d.position[2] + 0.5f);
    const float x_min = (float)(cx - GRID_HALF), x_max = (float)(cx + GRID_HALF);
    const float z_min = (float)(cz - GRID_HALF), z_max = (float)(cz + GRID_HALF);
    for (int i = -GRID_HALF; i <= GRID_HALF; i++)
    {
        // Line along Z at x = cx + i, and along X at z = cz + i.
        const int x = cx + i, z = cz + i;
        const uint32_t x_color = x == 0 ? GRID_Z_AXIS_COLOR : x % GRID_MAJOR == 0 ? GRID_MAJOR_COLOR : GRID_COLOR;
        const uint32_t z_color = z == 0 ? GRID_X_AXIS_COLOR : z % GRID_MAJOR == 0 ? GRID_MAJOR_COLOR : GRID_COLOR;
        view_line(mat4_mul_point(&f->view, (float)x, 0.0f, z_min), mat4_mul_point(&f->view, (float)x, 0.0f, z_max),
                  x_color, &fade, f);
        view_line(mat4_mul_point(&f->view, x_min, 0.0f, (float)z), mat4_mul_point(&f->view, x_max, 0.0f, (float)z),
                  z_color, &fade, f);
    }
}

void render_light_gizmos(const lighting_t *lt, const camera_frame_t *f)
{
    for (int i = 0; i < lt->count; i++)
    {
        const light_view_t *l = &lt->lights[i];
        const vec3_t p = l->pos;
        const float s = GIZMO_SIZE * (fabsf(p.z) + f->z_near);
        const uint32_t color = l->gizmo_color;

        // Octahedron at the light's position.
        const vec3_t axis[3] = {vec3_new(s, 0, 0), vec3_new(0, s, 0), vec3_new(0, 0, s)};
        vec3_t tips[6];
        for (int k = 0; k < 3; k++)
        {
            tips[k * 2] = vec3_add(p, axis[k]);
            tips[k * 2 + 1] = vec3_sub(p, axis[k]);
        }
        for (int k = 0; k < 3; k++)
            for (int m = k + 1; m < 3; m++)
                for (int sk = 0; sk < 2; sk++)
                    for (int sm = 0; sm < 2; sm++)
                        gizmo_line(tips[k * 2 + sk], tips[m * 2 + sm], color, f);

        if (l->type == LIGHT_POINT)
            continue;

        // Basis around the light's direction.
        const vec3_t dir = l->dir;
        const vec3_t helper = fabsf(dir.y) < 0.9f ? vec3_new(0, 1, 0) : vec3_new(1, 0, 0);
        const vec3_t e1 = vec3_normalize_or(vec3_cross(dir, helper), vec3_new(1, 0, 0));
        const vec3_t e2 = vec3_cross(dir, e1);

        if (l->type == LIGHT_DIRECTIONAL)
        {
            // Arrow in the direction the light travels.
            vec3_t tip = vec3_add(p, vec3_mul(dir, 5.0f * s));
            vec3_t back = vec3_add(p, vec3_mul(dir, 4.0f * s));
            gizmo_line(p, tip, color, f);
            gizmo_line(tip, vec3_add(back, vec3_mul(e1, 0.6f * s)), color, f);
            gizmo_line(tip, vec3_sub(back, vec3_mul(e1, 0.6f * s)), color, f);
            gizmo_line(tip, vec3_add(back, vec3_mul(e2, 0.6f * s)), color, f);
            gizmo_line(tip, vec3_sub(back, vec3_mul(e2, 0.6f * s)), color, f);
            continue;
        }

        // Spot: the outer cone, as long as the light's range.
        float length = l->range > 0.0f ? l->range : 8.0f * s;
        float co = l->cos_outer > 0.05f ? l->cos_outer : 0.05f;
        float radius = length * sqrtf(1.0f - co * co) / co;
        vec3_t base = vec3_add(p, vec3_mul(dir, length));
        enum { SEGMENTS = 24 };
        vec3_t prev = vec3_add(base, vec3_mul(e1, radius));
        for (int k = 1; k <= SEGMENTS; k++)
        {
            float ang = 6.2831853f * (float)k / SEGMENTS;
            vec3_t cur = vec3_add(base, vec3_add(vec3_mul(e1, cosf(ang) * radius), vec3_mul(e2, sinf(ang) * radius)));
            gizmo_line(prev, cur, color, f);
            if (k % (SEGMENTS / 4) == 0)
                gizmo_line(p, cur, color, f);
            prev = cur;
        }
    }
}
