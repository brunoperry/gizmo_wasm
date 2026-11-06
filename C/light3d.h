#ifndef LIGHT_H
#define LIGHT_H

#include <stdint.h>
#include "matrix.h"
#include "shadow.h"

#define MAX_LIGHTS 8 // keep in sync with Light3D.MAX_LIGHTS (javascript)

enum
{
    LIGHT_DIRECTIONAL = 0,
    LIGHT_POINT = 1,
    LIGHT_SPOT = 2,
};

// How lighting is evaluated (display.render_mode[1]).
enum
{
    LIGHTING_TRIANGLE = 0, // once per triangle, at its centre (flat)
    LIGHTING_VERTEX = 1,   // per vertex, interpolated (Gouraud)
    LIGHTING_PIXEL = 2,    // per pixel, from interpolated position + normal
};

// Float block written by javascript (see Scene.js / Light3D.js):
//   header:    count, ambient r, ambient g, ambient b
//   per light: type, intensity, range, cos_inner, cos_outer, r, g, b,
//              position xyz, direction xyz, casts shadows, (1 unused)
#define LIGHT_HEADER 4
#define LIGHT_STRIDE 16
extern float *light_data;

// One light, prepared for the current frame in view space.
typedef struct
{
    int type;
    vec3_t color; // color * intensity
    vec3_t pos;   // view space
    vec3_t dir;   // view space, unit, the way the light travels
    float range;
    float inv_range_sq; // 0 = no falloff
    float cos_outer;
    float inv_cone; // 1 / (cos_inner - cos_outer)
    float cos_inner;
    uint32_t gizmo_color;
    vec3_t pos_world, dir_world; // dir_world: unit
    int casts_shadows;
    const shadow_t *shadow; // this frame's shadow map, NULL = no shadows
} light_view_t;

typedef struct
{
    vec3_t ambient;
    int count;
    int has_local; // any point/spot light (otherwise every light reaches everything)
    unsigned char all[MAX_LIGHTS]; // 0, 1, 2... for when no selection is needed
    mat4_t view_inv; // view -> world, for shadow lookups
    light_view_t lights[MAX_LIGHTS];
} lighting_t;

// Reads light_data and moves every light into view space.
void lighting_frame(lighting_t *out, const mat4_t *view);

// Lights that can reach a sphere (view space): directional lights always,
// point/spot lights within range. Returns how many indices were written.
int lighting_select(const lighting_t *lt, vec3_t center, float radius, unsigned char *active);

// Light arriving at view-space point p with outward unit normal n:
// ambient + sum of lambert * falloff * cone * color. Not clamped.
static inline vec3_t lighting_eval(const lighting_t *lt, const unsigned char *active, int count, vec3_t p, vec3_t n)
{
    vec3_t sum = lt->ambient;
    vec3_t p_world, n_world;
    int have_world = 0;
    for (int i = 0; i < count; i++)
    {
        const light_view_t *l = &lt->lights[active[i]];
        vec3_t to_light;
        float k = 1.0f;
        if (l->type == LIGHT_DIRECTIONAL)
            to_light = vec3_mul(l->dir, -1.0f);
        else
        {
            vec3_t d = vec3_sub(l->pos, p);
            float d_sq = vec3_dot(d, d);
            // Smooth window: 1 at the light, 0 at `range`.
            float x = d_sq * l->inv_range_sq;
            if (x >= 1.0f)
                continue;
            k = (1.0f - x) * (1.0f - x);
            to_light = vec3_mul(d, 1.0f / sqrtf(d_sq + 1e-12f));
            if (l->type == LIGHT_SPOT)
            {
                float s = (-vec3_dot(to_light, l->dir) - l->cos_outer) * l->inv_cone;
                if (s <= 0.0f)
                    continue;
                if (s < 1.0f)
                    k *= s * s * (3.0f - 2.0f * s); // smoothstep between the cones
            }
        }
        float lambert = vec3_dot(n, to_light);
        if (lambert <= 0.0f)
            continue;
        if (l->shadow)
        {
            if (!have_world)
            {
                p_world = mat4_mul_point(&lt->view_inv, p.x, p.y, p.z);
                n_world = mat4_mul_dir(&lt->view_inv, n);
                have_world = 1;
            }
            float visible = shadow_visibility(l->shadow, p_world, n_world);
            if (visible <= 0.0f)
                continue;
            k *= visible;
        }
        sum = vec3_add(sum, vec3_mul(l->color, k * lambert));
    }
    return sum;
}

#endif
