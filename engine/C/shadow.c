// Shadow maps: each shadow-casting light renders the closeness of the
// objects into its map, whenever something it depends on changed (no back-face culling, so open meshes and
// planes cast shadows too). See shadow.h for the lookups.
#include <string.h>
#include "shadow_pass.h"
#include "raster.h"
#include "renderer.h"
#include "memory.h"

#define CUBE_PROJ 0.95f // a bit wider than 90 degrees, so filtering at face edges stays inside

static shadow_t shadows[MAX_LIGHTS];
// What each map was rendered from: if nothing changed, it is reused.
static uint32_t signatures[MAX_LIGHTS];
static int valid[MAX_LIGHTS];

static inline uint32_t hash_floats(uint32_t h, const float *f, int n)
{
    for (int i = 0; i < n; i++)
    {
        uint32_t bits;
        memcpy(&bits, &f[i], 4);
        h = (h ^ bits) * 16777619u; // FNV-1a, per float
    }
    return h;
}

// A directional light's map can follow the camera instead of holding every
// object (light_view_t.shadow_distance): a square window in light space
// (x, y: across the light), `radius` to each side of (cx, cy).
typedef struct
{
    int on;
    float cx, cy, radius;
} window_t;

// Shadow maps depend on the light and on every object's transform; on the
// camera only through the window, which moves in whole texels.
static uint32_t signature(const light_view_t *l, const window_t *w, object3d_t *const *objects, int count)
{
    const float light[] = {(float)l->type, l->range, l->cos_outer,
                           l->pos_world.x, l->pos_world.y, l->pos_world.z,
                           l->dir_world.x, l->dir_world.y, l->dir_world.z, (float)count,
                           (float)w->on, w->cx, w->cy, w->radius};
    uint32_t h = hash_floats(2166136261u, light, 14);
    for (int o = 0; o < count; o++)
    {
        uint32_t id = (uint32_t)(uintptr_t)objects[o];
        h = (h ^ id) * 16777619u;
        h = hash_floats(h, objects[o]->position, 3);
        h = hash_floats(h, objects[o]->rotation, 3);
        h = hash_floats(h, objects[o]->scale, 3);
        h = (h ^ objects[o]->deform_version) * 16777619u; // animated poses
        h = (h ^ (uint32_t)*objects[o]->casts_shadows) * 16777619u;
    }
    return h;
}

// Can an object reach anything a point/spot light lights? (bounding sphere vs range)
static int in_range(const object3d_t *obj, const mat4_t *model, const light_view_t *l)
{
    if (l->type == LIGHT_DIRECTIONAL || !(l->range > 0.0f))
        return 1;
    const float *lo = obj->bounds_min, *hi = obj->bounds_max;
    vec3_t center = mat4_mul_point(model, 0.5f * (lo[0] + hi[0]), 0.5f * (lo[1] + hi[1]), 0.5f * (lo[2] + hi[2]));
    vec3_t half = vec3_new(0.5f * (hi[0] - lo[0]), 0.5f * (hi[1] - lo[1]), 0.5f * (hi[2] - lo[2]));
    const float *s = obj->scale;
    float max_scale = fabsf(s[0]);
    if (fabsf(s[1]) > max_scale) max_scale = fabsf(s[1]);
    if (fabsf(s[2]) > max_scale) max_scale = fabsf(s[2]);
    float radius = vec3_length(half) * max_scale;
    vec3_t d = vec3_sub(center, l->pos_world);
    float reach = l->range + radius;
    return vec3_dot(d, d) < reach * reach;
}

// Rows: right, up, forward (light space), translated so `origin` is at 0.
static mat4_t light_basis(vec3_t forward, vec3_t origin)
{
    vec3_t helper = fabsf(forward.y) < 0.99f ? vec3_new(0, 1, 0) : vec3_new(1, 0, 0);
    vec3_t right = vec3_normalize_or(vec3_cross(helper, forward), vec3_new(1, 0, 0));
    vec3_t up = vec3_cross(forward, right);
    return (mat4_t){{{right.x, right.y, right.z, -vec3_dot(right, origin)},
                     {up.x, up.y, up.z, -vec3_dot(up, origin)},
                     {forward.x, forward.y, forward.z, -vec3_dot(forward, origin)},
                     {0, 0, 0, 1}}};
}

// Objects left out of the map being rendered: they don't cast shadows, are
// out of a light's range, or outside a directional light's window.
static unsigned char skip[MAX_OBJECTS];

// Where a directional light's map goes when it follows the camera: around
// the sphere that holds the view up to shadow_distance. The sphere keeps its
// size while the camera turns, and its centre moves in whole texels, so the
// shadows' edges don't crawl.
static window_t view_window(const light_view_t *l, const camera_frame_t *f, const mat4_t *view_inv)
{
    window_t w = {0, 0.0f, 0.0f, 0.0f};
    const float dist = l->shadow_distance;
    if (l->type != LIGHT_DIRECTIONAL || !(dist > 0.0f))
        return w;

    // The far corners of the view at depth `dist` are (tx, ty, dist): the
    // sphere through them and the eye is centred `ahead` along the view.
    const float tx = dist / f->proj_x, ty = dist / f->proj_y;
    const float k = tx * tx + ty * ty;
    float ahead = (dist * dist + k) / (2.0f * dist), radius = ahead;
    if (ahead > dist) // very wide view: centred on the far plane
        ahead = dist, radius = sqrtf(k);
    // In steps, so a changing field of view rarely changes the texel size.
    const float step = dist * 0.125f;
    radius = ceilf(radius / step) * step;

    const mat4_t basis = light_basis(l->dir_world, vec3_new(0, 0, 0));
    const vec3_t c = mat4_mul_point(&basis, view_inv->m[0][3] + view_inv->m[0][2] * ahead,
                                    view_inv->m[1][3] + view_inv->m[1][2] * ahead,
                                    view_inv->m[2][3] + view_inv->m[2][2] * ahead);
    const float texel = 2.0f * radius / SHADOW_SIZE;
    w.on = 1;
    w.cx = floorf(c.x / texel) * texel;
    w.cy = floorf(c.y / texel) * texel;
    w.radius = radius;
    return w;
}

// Directional: an orthographic map fitted around the bounds of the objects
// that cast shadows, or the window `w` (then only the ones over it are
// drawn). Returns 0 when there is nothing to draw.
static int setup_directional(shadow_t *s, const light_view_t *l, const window_t *w, object3d_t *const *objects, int count)
{
    const mat4_t basis = light_basis(l->dir_world, vec3_new(0, 0, 0));
    float lo[3] = {1e30f, 1e30f, 1e30f}, hi[3] = {-1e30f, -1e30f, -1e30f}; // no INFINITY under -ffast-math
    for (int o = 0; o < count; o++)
    {
        const mat4_t m = mat4_mul_mat4(basis, object_model_matrix(objects[o]));
        const float *bmin = objects[o]->bounds_min, *bmax = objects[o]->bounds_max;
        float olo[3] = {1e30f, 1e30f, 1e30f}, ohi[3] = {-1e30f, -1e30f, -1e30f};
        for (int k = 0; k < 8; k++)
        {
            vec3_t q = mat4_mul_point(&m, (k & 1) ? bmax[0] : bmin[0], (k & 2) ? bmax[1] : bmin[1],
                                      (k & 4) ? bmax[2] : bmin[2]);
            const float v[3] = {q.x, q.y, q.z};
            for (int i = 0; i < 3; i++)
            {
                if (v[i] < olo[i]) olo[i] = v[i];
                if (v[i] > ohi[i]) ohi[i] = v[i];
            }
        }
        const int outside = !objects[o]->num_triangles ||
                            (w->on && (ohi[0] < w->cx - w->radius || olo[0] > w->cx + w->radius ||
                                       ohi[1] < w->cy - w->radius || olo[1] > w->cy + w->radius));
        skip[o] = outside || !*objects[o]->casts_shadows;
        if (outside)
            continue;
        // The depth range also holds the objects that only receive shadows:
        // their closeness must stay above 0, which means "empty" in the map.
        if (olo[2] < lo[2]) lo[2] = olo[2];
        if (ohi[2] > hi[2]) hi[2] = ohi[2];
        if (skip[o])
            continue;
        for (int i = 0; i < 2; i++)
        {
            if (olo[i] < lo[i]) lo[i] = olo[i];
            if (ohi[i] > hi[i]) hi[i] = ohi[i];
        }
    }
    if (!(hi[0] >= lo[0]) || !(hi[1] >= lo[1]))
        return 0;

    s->fade = 0.0f;
    if (w->on)
    {
        lo[0] = w->cx - w->radius, hi[0] = w->cx + w->radius;
        lo[1] = w->cy - w->radius, hi[1] = w->cy + w->radius;
        hi[2] += 1e-3f;
        s->fade = 1.0f / (SHADOW_SIZE / 16); // shadows fade out over the last texels
    }
    else
    {
        // Pad a little so nothing sits exactly on the border.
        float pad = 0.02f * ((hi[0] - lo[0]) > (hi[1] - lo[1]) ? hi[0] - lo[0] : hi[1] - lo[1]) + 1e-3f;
        lo[0] -= pad, lo[1] -= pad, hi[0] += pad, hi[1] += pad, hi[2] += pad;
    }

    s->size = SHADOW_SIZE;
    s->faces = 1;
    s->ortho = 1;
    const float sx = SHADOW_SIZE / (hi[0] - lo[0]), sy = SHADOW_SIZE / (hi[1] - lo[1]);
    s->texel = 1.0f / (sx < sy ? sx : sy);
    // (x - lo_x) * sx, (hi_y - y) * sy, (hi_z - z) + 1
    mat4_t fit = {{{sx, 0, 0, -lo[0] * sx},
                   {0, -sy, 0, hi[1] * sy},
                   {0, 0, -1, hi[2] + 1.0f},
                   {0, 0, 0, 1}}};
    s->world_to_face[0] = mat4_mul_mat4(fit, basis);
    return 1;
}

static void setup_perspective(shadow_t *s, const light_view_t *l, object3d_t *const *objects, int count)
{
    for (int o = 0; o < count; o++)
    {
        const mat4_t model = object_model_matrix(objects[o]);
        skip[o] = !*objects[o]->casts_shadows || !in_range(objects[o], &model, l);
    }
    s->fade = 0.0f;
    s->ortho = 0;
    s->origin = l->pos_world;
    s->z_near = l->range > 0.0f ? l->range * 0.001f : 0.01f;
    if (s->z_near < 0.005f) s->z_near = 0.005f;

    if (l->type == LIGHT_SPOT)
    {
        s->size = SHADOW_SIZE;
        s->faces = 1;
        // Field of view: the outer cone plus a margin for filtering.
        float co = l->cos_outer > 0.0f ? l->cos_outer : 0.0f;
        float half = acosf(co) * 1.05f + 0.02f;
        if (half > 1.48f) half = 1.48f; // ~85 degrees
        s->proj = 1.0f / tanf(half);
        s->world_to_face[0] = light_basis(l->dir_world, l->pos_world);
    }
    else
    {
        s->size = SHADOW_CUBE_SIZE;
        s->faces = 6;
        s->proj = CUBE_PROJ;
        const vec3_t axes[6] = {vec3_new(1, 0, 0), vec3_new(-1, 0, 0), vec3_new(0, 1, 0),
                                vec3_new(0, -1, 0), vec3_new(0, 0, 1), vec3_new(0, 0, -1)};
        for (int f = 0; f < 6; f++)
            s->world_to_face[f] = light_basis(axes[f], l->pos_world);
    }
    // Width of a texel at distance 1.
    s->texel = 2.0f / (s->proj * (float)s->size);
}

typedef struct
{
    float x, y, z;
} lvert_t;

// Perspective face: cull, clip against the near plane, project, rasterize.
static void draw_perspective(const shadow_t *s, float *map, unsigned char *cover, float far, const lvert_t *tri)
{
    // Outside one side of the frustum (or entirely beyond the light's range)?
    unsigned out_all = 0x3F;
    for (int i = 0; i < 3; i++)
    {
        const lvert_t *v = &tri[i];
        unsigned code = 0;
        if (v->z + v->x * s->proj < 0) code |= 1;
        if (v->z - v->x * s->proj < 0) code |= 2;
        if (v->z + v->y * s->proj < 0) code |= 4;
        if (v->z - v->y * s->proj < 0) code |= 8;
        if (v->z < s->z_near) code |= 16;
        if (far > 0.0f && v->z > far) code |= 32;
        out_all &= code;
    }
    if (out_all)
        return;

    // Sutherland-Hodgman against z = z_near.
    lvert_t poly[4];
    int n = 0;
    for (int i = 0; i < 3; i++)
    {
        const lvert_t *a = &tri[i], *b = &tri[(i + 1) % 3];
        float da = a->z - s->z_near, db = b->z - s->z_near;
        if (da >= 0)
            poly[n++] = *a;
        if ((da >= 0) != (db >= 0))
        {
            float t = da / (da - db);
            poly[n++] = (lvert_t){a->x + (b->x - a->x) * t, a->y + (b->y - a->y) * t, s->z_near};
        }
    }
    if (n < 3)
        return;

    const float half = 0.5f * (float)s->size;
    float sv[4][3];
    for (int i = 0; i < n; i++)
    {
        float iz = 1.0f / poly[i].z;
        sv[i][0] = half + poly[i].x * iz * s->proj * half;
        sv[i][1] = half - poly[i].y * iz * s->proj * half;
        sv[i][2] = iz;
    }
    for (int i = 1; i < n - 1; i++)
        raster_depth(map, cover, s->size, sv[0], sv[i], sv[i + 1]);
}

static void render_map(shadow_t *s, const light_view_t *l, object3d_t *const *objects, int count)
{
    const size_t face_len = (size_t)s->size * s->size;
    const size_t cover_len = face_len >> (2 * SHADOW_BLOCK_SHIFT);
    memset(s->map, 0, face_len * s->faces * sizeof(float));
    memset(s->cover, 0, cover_len * s->faces);
    const float far = l->type == LIGHT_DIRECTIONAL ? 0.0f : l->range;

    for (int o = 0; o < count; o++)
    {
        if (skip[o])
            continue;
        const object3d_t *obj = objects[o];
        const mat4_t model = object_model_matrix(obj);
        for (int f = 0; f < s->faces; f++)
        {
            const mat4_t m = mat4_mul_mat4(s->world_to_face[f], model);
            float *map = s->map + face_len * f;
            unsigned char *cover = s->cover + cover_len * f;
            const float *vp = obj->vertices;
            for (int t = 0; t < obj->num_triangles; t++, vp += 9)
            {
                lvert_t tri[3];
                for (int i = 0; i < 3; i++)
                {
                    vec3_t q = mat4_mul_point(&m, vp[i * 3], vp[i * 3 + 1], vp[i * 3 + 2]);
                    tri[i] = (lvert_t){q.x, q.y, q.z};
                }
                if (s->ortho)
                    raster_depth(map, cover, s->size, &tri[0].x, &tri[1].x, &tri[2].x);
                else
                    draw_perspective(s, map, cover, far, tri);
            }
        }
    }

    if (s->ortho)
    {
        const int blocks = s->size >> SHADOW_BLOCK_SHIFT, stride = blocks + 1;
        const unsigned char *cover = s->cover;
        uint16_t *sum = s->cover_sum;
        memset(sum, 0, stride * sizeof(uint16_t));
        for (int y = 0; y < blocks; y++, cover += blocks)
        {
            sum += stride;
            int row = 0;
            sum[0] = 0;
            for (int x = 0; x < blocks; x++)
            {
                row += cover[x];
                sum[x + 1] = (uint16_t)(sum[x + 1 - stride] + row);
            }
        }
    }
}

void shadows_release(uintptr_t mark)
{
    for (int i = 0; i < MAX_LIGHTS; i++)
    {
        valid[i] = 0;
        if (gz_after(shadows[i].map, mark))
            shadows[i].map = NULL, shadows[i].cover = NULL, shadows[i].cover_sum = NULL;
    }
}

void shadows_render(lighting_t *lt, object3d_t *const *objects, int count, const camera_frame_t *frame)
{
    for (int i = 0; i < lt->count; i++)
    {
        light_view_t *l = &lt->lights[i];
        l->shadow = 0;
        if (!l->casts_shadows || count == 0)
            continue;

        shadow_t *s = &shadows[i];
        const window_t window = view_window(l, frame, &lt->view_inv);
        const uint32_t sig = signature(l, &window, objects, count);
        if (valid[i] && signatures[i] == sig)
        {
            l->shadow = s; // nothing moved: last frame's map is still right
            continue;
        }
        valid[i] = 0;
        if (!s->map)
        {
            // One allocation per slot that fits any light type.
            size_t flat = (size_t)SHADOW_SIZE * SHADOW_SIZE, cube = (size_t)6 * SHADOW_CUBE_SIZE * SHADOW_CUBE_SIZE;
            const size_t texels = flat > cube ? flat : cube;
            float *map = gz_alloc(texels * sizeof(float));
            s->cover = gz_alloc(texels >> (2 * SHADOW_BLOCK_SHIFT));
            const size_t stride = (SHADOW_SIZE >> SHADOW_BLOCK_SHIFT) + 1;
            s->cover_sum = gz_alloc(stride * stride * sizeof(uint16_t));
            if (!map || !s->cover || !s->cover_sum)
                continue;
            s->map = map;
        }

        if (l->type == LIGHT_DIRECTIONAL)
        {
            if (!setup_directional(s, l, &window, objects, count))
                continue;
        }
        else
            setup_perspective(s, l, objects, count);

        render_map(s, l, objects, count);
        l->shadow = s;
        signatures[i] = sig;
        valid[i] = 1;
    }
}
