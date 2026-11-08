#include <math.h>
#include "raster.h"
#include "display.h"

#define ALWAYS_INLINE static inline __attribute__((always_inline))

// Perspective-correct values are computed exactly every SPAN pixels and
// interpolated linearly in between.
#define SPAN 16
#define FIXED_SHIFT 16
#define FIXED_ONE 65536.0f

enum
{
    TEX_NONE = 0,
    TEX_POT = 1,  // power-of-two: wrap with masks
    TEX_NPOT = 2, // any size: wrap with modulo
};

// Alpha-blends src over dst (same formula the engine always used).
ALWAYS_INLINE uint32_t color_blend(uint32_t src, uint32_t dst)
{
    uint32_t a = src >> 24, ia = 255 - a;
    uint32_t rb = (((src & 0x00FF00FFu) * a + (dst & 0x00FF00FFu) * ia) >> 8) & 0x00FF00FFu;
    uint32_t g = (((src & 0x0000FF00u) * a + (dst & 0x0000FF00u) * ia) >> 8) & 0x0000FF00u;
    uint32_t out_a = a + (((dst >> 24) * ia) >> 8);
    return (out_a << 24) | rb | g;
}

ALWAYS_INLINE int wrap(int i, int size)
{
    i %= size;
    return i < 0 ? i + size : i;
}

// Scanline rasterizer with top-left fill rule (pixel centers at .5), so
// triangles sharing an edge never overdraw or leave gaps.
//
// 1/w and every attribute/w are linear in screen space: their gradients are
// computed once per triangle and stepped per pixel. Rows and spans are
// clamped to the display, so nothing is ever written out of bounds.
//
// `tex_kind` and `lighting` are compile-time constants at every call site,
// so each combination gets its own specialized loop.
ALWAYS_INLINE void raster_impl(const svert_t *v0, const svert_t *v1, const svert_t *v2,
                               const int tex_kind, const int lighting, const raster_params_t *p)
{
    const int textured = tex_kind != TEX_NONE;
    const int nattr = lighting == LIGHTING_VERTEX ? 3 : lighting == LIGHTING_PIXEL ? 6 : 0;

    const svert_t *t;
    if (v1->y < v0->y) t = v0, v0 = v1, v1 = t;
    if (v2->y < v1->y) t = v1, v1 = v2, v2 = t;
    if (v1->y < v0->y) t = v0, v0 = v1, v1 = t;

    const float x0 = v0->x, y0 = v0->y;
    const float x1 = v1->x, y1 = v1->y;
    const float x2 = v2->x, y2 = v2->y;
    const float dx1 = x1 - x0, dy1 = y1 - y0;
    const float dx2 = x2 - x0, dy2 = y2 - y0;

    // Twice the signed area; also tells which side the long edge (v0->v2) is on.
    const float det = dx1 * dy2 - dx2 * dy1;
    if (!(fabsf(det) > 1e-6f)) // degenerate (or NaN)
        return;
    const float inv_det = 1.0f / det;

#define GRAD_X(a0, a1, a2) ((((a1) - (a0)) * dy2 - ((a2) - (a0)) * dy1) * inv_det)
#define GRAD_Y(a0, a1, a2) ((((a2) - (a0)) * dx1 - ((a1) - (a0)) * dx2) * inv_det)
    const float diw_dx = GRAD_X(v0->iw, v1->iw, v2->iw);
    const float diw_dy = GRAD_Y(v0->iw, v1->iw, v2->iw);
    float du_dx = 0, du_dy = 0, dv_dx = 0, dv_dy = 0;
    if (textured)
    {
        du_dx = GRAD_X(v0->u, v1->u, v2->u);
        du_dy = GRAD_Y(v0->u, v1->u, v2->u);
        dv_dx = GRAD_X(v0->v, v1->v, v2->v);
        dv_dy = GRAD_Y(v0->v, v1->v, v2->v);
    }
    float da_dx[RASTER_MAX_ATTRS], da_dy[RASTER_MAX_ATTRS];
    for (int k = 0; k < nattr; k++)
    {
        da_dx[k] = GRAD_X(v0->a[k], v1->a[k], v2->a[k]);
        da_dy[k] = GRAD_Y(v0->a[k], v1->a[k], v2->a[k]);
    }
#undef GRAD_X
#undef GRAD_Y

    const int width = display.width, height = display.height;

    int y_start = (int)ceilf(y0 - 0.5f);
    int y_end = (int)ceilf(y2 - 0.5f); // exclusive
    if (y_start < 0) y_start = 0;
    if (y_end > height) y_end = height;

    // dy2 > 0 is guaranteed by det != 0.
    const float slope_long = dx2 / dy2;
    const float slope_top = dy1 > 0 ? dx1 / dy1 : 0.0f;
    const float slope_bottom = (y2 - y1) > 0 ? (x2 - x1) / (y2 - y1) : 0.0f;
    const int long_is_left = det > 0;

    const texture_t *tex = p->tex;
    const int tex_w = textured ? tex->width : 0;
    const int tex_h = textured ? tex->height : 0;
    const int w_mask = tex_w - 1, h_mask = tex_h - 1, w_shift = textured ? tex->w_shift : 0;
    const uint32_t *pixels = textured ? tex->pixels : 0;
    const float inv_tex_w = textured ? 1.0f / tex_w : 0.0f;
    const float inv_tex_h = textured ? 1.0f / tex_h : 0.0f;

    const int flat_r = p->light[0], flat_g = p->light[1], flat_b = p->light[2];
    const uint32_t flat_color = color_modulate(p->color, flat_r, flat_g, flat_b);

    for (int y = y_start; y < y_end; y++)
    {
        const float py = (float)y + 0.5f;
        const float x_long = x0 + (py - y0) * slope_long;
        const float x_short = py < y1 ? x0 + (py - y0) * slope_top
                                      : x1 + (py - y1) * slope_bottom;
        const float xl = long_is_left ? x_long : x_short;
        const float xr = long_is_left ? x_short : x_long;

        int x_start = (int)ceilf(xl - 0.5f);
        int x_end = (int)ceilf(xr - 0.5f); // exclusive
        if (x_start < 0) x_start = 0;
        if (x_end > width) x_end = width;
        if (x_start >= x_end)
            continue;

        const float ox = (float)x_start + 0.5f - x0, oy = py - y0;
        float iw = v0->iw + diw_dx * ox + diw_dy * oy;

        uint32_t *restrict cp = display.color + y * width + x_start;
        float *restrict zp = display.depth + y * width + x_start;
        const int count = x_end - x_start;

        // Flat color, nothing to interpolate but depth.
        if (!textured && lighting == LIGHTING_TRIANGLE)
        {
            for (int i = 0; i < count; i++)
            {
                if (iw > zp[i])
                {
                    zp[i] = iw;
                    cp[i] = flat_color;
                }
                iw += diw_dx;
            }
            continue;
        }

        float u = 0, v = 0, a[RASTER_MAX_ATTRS];
        if (textured)
        {
            u = v0->u + du_dx * ox + du_dy * oy;
            v = v0->v + dv_dx * ox + dv_dy * oy;
        }
        for (int k = 0; k < nattr; k++)
            a[k] = v0->a[k] + da_dx[k] * ox + da_dy[k] * oy;

        // Values at the start of the current span, divided back by 1/w.
        float inv = 1.0f / iw;
        float u_start = u * inv, v_start = v * inv;
        float a_start[RASTER_MAX_ATTRS];
        for (int k = 0; k < nattr; k++)
            a_start[k] = a[k] * inv;

        for (int i = 0; i < count;)
        {
            int n = count - i;
            if (n > SPAN) n = SPAN;
            const float inv_n = 1.0f / (float)n;
            const float inv_end = 1.0f / (iw + diw_dx * n);

            // Texture: affine 16.16 fixed point across the span.
            int32_t uf = 0, vf = 0, duf = 0, dvf = 0;
            float u_end = 0, v_end = 0;
            if (textured)
            {
                u += du_dx * n;
                v += dv_dx * n;
                u_end = u * inv_end;
                v_end = v * inv_end;
                // Wrap the start into the texture so fixed point can't overflow.
                float u_base = u_start - floorf(u_start * inv_tex_w) * (float)tex_w;
                float v_base = v_start - floorf(v_start * inv_tex_h) * (float)tex_h;
                uf = (int32_t)(u_base * FIXED_ONE);
                vf = (int32_t)(v_base * FIXED_ONE);
                duf = (int32_t)((u_end - u_start) * FIXED_ONE * inv_n);
                dvf = (int32_t)((v_end - v_start) * FIXED_ONE * inv_n);
            }

            // Lighting attributes: linear across the span. Per-vertex light
            // (0..1) goes to 8.16 fixed point, so pixels only shift.
            float a_end[RASTER_MAX_ATTRS], av[RASTER_MAX_ATTRS], da[RASTER_MAX_ATTRS];
            int32_t lf[3] = {0, 0, 0}, dlf[3] = {0, 0, 0};
            for (int k = 0; k < nattr; k++)
            {
                a[k] += da_dx[k] * n;
                a_end[k] = a[k] * inv_end;
                av[k] = a_start[k];
                da[k] = (a_end[k] - a_start[k]) * inv_n;
            }
            if (lighting == LIGHTING_VERTEX)
                for (int k = 0; k < 3; k++)
                {
                    lf[k] = (int32_t)(a_start[k] * 256.0f * FIXED_ONE);
                    dlf[k] = (int32_t)((a_end[k] - a_start[k]) * 256.0f * FIXED_ONE * inv_n);
                }

            for (const int end = i + n; i < end; i++)
            {
                if (iw > zp[i])
                {
                    zp[i] = iw;

                    uint32_t base = p->color;
                    if (tex_kind == TEX_POT)
                        base = pixels[(((vf >> FIXED_SHIFT) & h_mask) << w_shift) | ((uf >> FIXED_SHIFT) & w_mask)];
                    else if (tex_kind == TEX_NPOT)
                        base = pixels[wrap(vf >> FIXED_SHIFT, tex_h) * tex_w + wrap(uf >> FIXED_SHIFT, tex_w)];

                    int lr = flat_r, lg = flat_g, lb = flat_b;
                    if (lighting == LIGHTING_VERTEX)
                    {
                        lr = lf[0] >> FIXED_SHIFT;
                        lg = lf[1] >> FIXED_SHIFT;
                        lb = lf[2] >> FIXED_SHIFT;
                    }
                    else if (lighting == LIGHTING_PIXEL)
                    {
                        vec3_t n3 = vec3_new(av[3], av[4], av[5]);
                        n3 = vec3_mul(n3, 1.0f / sqrtf(vec3_dot(n3, n3) + 1e-20f));
                        vec3_t l = lighting_eval(p->lights, p->active, p->active_count,
                                                 vec3_new(av[0], av[1], av[2]), n3);
                        lr = light_to_int(l.x);
                        lg = light_to_int(l.y);
                        lb = light_to_int(l.z);
                    }

                    uint32_t c = color_modulate(base, lr, lg, lb);
                    cp[i] = (!textured || (c >> 24) == 0xFF) ? c : color_blend(c, cp[i]);
                }
                iw += diw_dx;
                uf += duf;
                vf += dvf;
                if (lighting == LIGHTING_VERTEX)
                    for (int k = 0; k < 3; k++)
                        lf[k] += dlf[k];
                else
                    for (int k = 0; k < nattr; k++)
                        av[k] += da[k];
            }
            u_start = u_end;
            v_start = v_end;
            for (int k = 0; k < nattr; k++)
                a_start[k] = a_end[k];
        }
    }
}

#define RASTER_LIGHTING(tk)                                                        \
    switch (p->lighting)                                                           \
    {                                                                              \
    case LIGHTING_VERTEX: raster_impl(a, b, c, tk, LIGHTING_VERTEX, p); break;     \
    case LIGHTING_PIXEL: raster_impl(a, b, c, tk, LIGHTING_PIXEL, p); break;       \
    default: raster_impl(a, b, c, tk, LIGHTING_TRIANGLE, p); break;                \
    }

void raster_triangle(const svert_t *a, const svert_t *b, const svert_t *c, const raster_params_t *p)
{
    if (!p->tex)
        RASTER_LIGHTING(TEX_NONE)
    else if (p->tex->is_pot)
        RASTER_LIGHTING(TEX_POT)
    else
        RASTER_LIGHTING(TEX_NPOT)
}

void raster_line(float x0, float y0, float x1, float y1, uint32_t color)
{
    const int width = display.width, height = display.height;
    float dx = x1 - x0, dy = y1 - y0;
    float adx = fabsf(dx), ady = fabsf(dy);
    int steps = (int)(adx > ady ? adx : ady);
    if (steps > width + height) // can't be longer than that once clipped
        steps = width + height;

    float x_inc = steps ? dx / steps : 0, y_inc = steps ? dy / steps : 0;
    float x = x0, y = y0;
    for (int i = 0; i <= steps; i++)
    {
        int px = (int)x, py = (int)y;
        if ((unsigned)px < (unsigned)width && (unsigned)py < (unsigned)height)
            display.color[py * width + px] = color;
        x += x_inc;
        y += y_inc;
    }
}

// Straight-alpha "over": src with opacity alpha on top of dst.
static uint32_t blend_over(uint32_t src, uint32_t dst, float alpha)
{
    const float da = (float)(dst >> 24) * (1.0f / 255.0f) * (1.0f - alpha);
    const float oa = alpha + da;
    const float ws = alpha / oa, wd = da / oa;
    uint32_t out = (uint32_t)(oa * 255.0f + 0.5f) << 24;
    for (int sh = 0; sh < 24; sh += 8)
        out |= (uint32_t)((float)((src >> sh) & 0xffu) * ws + (float)((dst >> sh) & 0xffu) * wd + 0.5f) << sh;
    return out;
}

#define FADE_LEVELS 16

void raster_line_depth(float x0, float y0, float iw0, float x1, float y1, float iw1, uint32_t color,
                       float fade_scale, float fade_offset)
{
    const int width = display.width, height = display.height;
    float dx = x1 - x0, dy = y1 - y0;
    float adx = fabsf(dx), ady = fabsf(dy);
    int steps = (int)(adx > ady ? adx : ady);
    if (steps > width + height)
        steps = width + height;

    // The clear color is translucent (the page shows through), so fading over
    // it needs a real "over" blend: done once per opacity level, not per pixel.
    // Cached: consecutive lines usually share their color.
    static uint32_t over_clear[FADE_LEVELS + 1], cached_color, cached_clear;
    static int cached = 0;
    const uint32_t clear = display.clear_color;
    if (!cached || cached_color != color || cached_clear != clear)
    {
        for (int l = 0; l <= FADE_LEVELS; l++)
            over_clear[l] = blend_over(color, clear, (float)l / FADE_LEVELS);
        cached_color = color, cached_clear = clear, cached = 1;
    }

    const float inv = steps ? 1.0f / steps : 0.0f;
    const float x_inc = dx * inv, y_inc = dy * inv, iw_inc = (iw1 - iw0) * inv;
    const uint32_t src_rb = color & 0x00ff00ffu, src_g = (color >> 8) & 0xffu;
    float x = x0, y = y0, iw = iw0;
    for (int i = 0; i <= steps; i++, x += x_inc, y += y_inc, iw += iw_inc)
    {
        int px = (int)x, py = (int)y;
        if ((unsigned)px >= (unsigned)width || (unsigned)py >= (unsigned)height)
            continue;
        const int k = py * width + px;
        // A little in front, so lines lying on a surface win over it.
        if (iw * LINE_DEPTH_BIAS < display.depth[k])
            continue;
        const float alpha = iw * fade_scale + fade_offset;
        if (alpha >= 1.0f)
        {
            display.color[k] = color;
            continue;
        }
        if (!(alpha > 0.0f))
            continue;
        const uint32_t dst = display.color[k];
        if (dst == clear)
            display.color[k] = over_clear[(int)(alpha * FADE_LEVELS + 0.5f)];
        else if (dst >> 24 == 0xffu)
        {
            // Opaque pixel: plain mix, two channels at a time (8.8 fixed point).
            const uint32_t a = (uint32_t)(alpha * 256.0f), b = 256u - a;
            const uint32_t rb = ((src_rb * a + (dst & 0x00ff00ffu) * b) >> 8) & 0x00ff00ffu;
            const uint32_t g = (src_g * a + ((dst >> 8) & 0xffu) * b) & 0xff00u;
            display.color[k] = 0xff000000u | rb | g;
        }
        else
            display.color[k] = blend_over(color, dst, alpha);
    }
}

void raster_depth(float *buf, int size, const float *a, const float *b, const float *c)
{
    const float *t;
    if (b[1] < a[1]) t = a, a = b, b = t;
    if (c[1] < b[1]) t = b, b = c, c = t;
    if (b[1] < a[1]) t = a, a = b, b = t;

    // Most triangles of detailed models are smaller than a texel: leave
    // before any division when no texel center is covered.
    int y_start = (int)ceilf(a[1] - 0.5f);
    int y_end = (int)ceilf(c[1] - 0.5f);
    if (y_start < 0) y_start = 0;
    if (y_end > size) y_end = size;
    if (y_start >= y_end)
        return;
    float min_x = a[0], max_x = a[0];
    if (b[0] < min_x) min_x = b[0];
    if (b[0] > max_x) max_x = b[0];
    if (c[0] < min_x) min_x = c[0];
    if (c[0] > max_x) max_x = c[0];
    if (ceilf(min_x - 0.5f) >= ceilf(max_x - 0.5f) || max_x < 0.0f || min_x > (float)size)
        return;

    const float dx1 = b[0] - a[0], dy1 = b[1] - a[1];
    const float dx2 = c[0] - a[0], dy2 = c[1] - a[1];
    const float det = dx1 * dy2 - dx2 * dy1;
    if (!(fabsf(det) > 1e-6f))
        return;
    const float inv_det = 1.0f / det;
    const float dz_dx = ((b[2] - a[2]) * dy2 - (c[2] - a[2]) * dy1) * inv_det;
    const float dz_dy = ((c[2] - a[2]) * dx1 - (b[2] - a[2]) * dx2) * inv_det;

    const float slope_long = dx2 / dy2;
    const float slope_top = dy1 > 0 ? dx1 / dy1 : 0.0f;
    const float slope_bottom = (c[1] - b[1]) > 0 ? (c[0] - b[0]) / (c[1] - b[1]) : 0.0f;
    const int long_is_left = det > 0;

    for (int y = y_start; y < y_end; y++)
    {
        const float py = (float)y + 0.5f;
        const float x_long = a[0] + (py - a[1]) * slope_long;
        const float x_short = py < b[1] ? a[0] + (py - a[1]) * slope_top
                                        : b[0] + (py - b[1]) * slope_bottom;
        const float xl = long_is_left ? x_long : x_short;
        const float xr = long_is_left ? x_short : x_long;
        int x_start = (int)ceilf(xl - 0.5f);
        int x_end = (int)ceilf(xr - 0.5f);
        if (x_start < 0) x_start = 0;
        if (x_end > size) x_end = size;
        if (x_start >= x_end)
            continue;

        // Written as an independent max per texel so it vectorizes (simd128).
        const float z0 = a[2] + dz_dx * ((float)x_start + 0.5f - a[0]) + dz_dy * (py - a[1]);
        float *restrict row = buf + (size_t)y * size + x_start;
        const int n = x_end - x_start;
        for (int i = 0; i < n; i++)
        {
            const float z = z0 + (float)i * dz_dx;
            row[i] = z > row[i] ? z : row[i];
        }
    }
}
