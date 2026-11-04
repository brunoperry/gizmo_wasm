#include <math.h>
#include "raster.h"
#include "display.h"

#define ALWAYS_INLINE static inline __attribute__((always_inline))

// Texture coordinates are perspective-corrected every SPAN pixels.
#define SPAN 16
#define FIXED_SHIFT 16
#define FIXED_ONE 65536.0f

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
// 1/w, u/w and v/w are linear in screen space: their gradients are computed
// once per triangle and stepped per pixel. Rows and spans are clamped to the
// display, so nothing is ever written out of bounds.
ALWAYS_INLINE void raster_triangle(const svert_t *v0, const svert_t *v1, const svert_t *v2,
                                   const int textured, const int pot,
                                   const texture_t *tex, uint32_t param)
{
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

    const int tex_w = textured ? tex->width : 0;
    const int tex_h = textured ? tex->height : 0;
    const int w_mask = tex_w - 1, h_mask = tex_h - 1, w_shift = textured ? tex->w_shift : 0;
    const uint32_t *pixels = textured ? tex->pixels : 0;
    const float inv_tex_w = textured ? 1.0f / tex_w : 0.0f;
    const float inv_tex_h = textured ? 1.0f / tex_h : 0.0f;

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
        float u = 0, v = 0;
        if (textured)
        {
            u = v0->u + du_dx * ox + du_dy * oy;
            v = v0->v + dv_dx * ox + dv_dy * oy;
        }

        uint32_t *restrict cp = display.color + y * width + x_start;
        float *restrict zp = display.depth + y * width + x_start;
        const int count = x_end - x_start;

        if (!textured)
        {
            for (int i = 0; i < count; i++)
            {
                if (iw > zp[i])
                {
                    zp[i] = iw;
                    cp[i] = param;
                }
                iw += diw_dx;
            }
            continue;
        }

        // Perspective-correct u,v every SPAN pixels, affine 16.16 fixed point
        // in between: one division per span instead of one per pixel.
        float inv = 1.0f / iw;
        float u_start = u * inv, v_start = v * inv;
        for (int i = 0; i < count;)
        {
            int n = count - i;
            if (n > SPAN) n = SPAN;

            u += du_dx * n;
            v += dv_dx * n;
            float inv_end = 1.0f / (iw + diw_dx * n);
            float u_end = u * inv_end, v_end = v * inv_end;

            // Wrap the start into the texture so fixed point can't overflow.
            float u_base = u_start - floorf(u_start * inv_tex_w) * (float)tex_w;
            float v_base = v_start - floorf(v_start * inv_tex_h) * (float)tex_h;
            float step = FIXED_ONE / (float)n;
            int32_t uf = (int32_t)(u_base * FIXED_ONE);
            int32_t vf = (int32_t)(v_base * FIXED_ONE);
            const int32_t duf = (int32_t)((u_end - u_start) * step);
            const int32_t dvf = (int32_t)((v_end - v_start) * step);

            for (const int end = i + n; i < end; i++)
            {
                if (iw > zp[i])
                {
                    zp[i] = iw;
                    int tx = uf >> FIXED_SHIFT, ty = vf >> FIXED_SHIFT;
                    uint32_t texel;
                    if (pot)
                        texel = pixels[((ty & h_mask) << w_shift) | (tx & w_mask)];
                    else
                        texel = pixels[wrap(ty, tex_h) * tex_w + wrap(tx, tex_w)];

                    texel = color_shade(texel, param);
                    cp[i] = (texel >> 24) == 0xFF ? texel : color_blend(texel, cp[i]);
                }
                iw += diw_dx;
                uf += duf;
                vf += dvf;
            }
            u_start = u_end;
            v_start = v_end;
        }
    }
}

void raster_flat(const svert_t *a, const svert_t *b, const svert_t *c, uint32_t color)
{
    raster_triangle(a, b, c, 0, 0, 0, color);
}

void raster_textured(const svert_t *a, const svert_t *b, const svert_t *c, const texture_t *tex, uint32_t shade)
{
    if (tex->is_pot)
        raster_triangle(a, b, c, 1, 1, tex, shade);
    else
        raster_triangle(a, b, c, 1, 0, tex, shade);
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
