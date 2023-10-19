#include "utils.h"

//////////////////////////////////////
// Utils
//////////////////////////////////////
inline vec3_t barycentric_weights(vec2_t a, vec2_t b, vec2_t c, vec2_t p)
{
    // Find the vectors between the vertices ABC and point p
    vec2_t ac = vec2_sub(c, a);
    vec2_t ab = vec2_sub(b, a);
    vec2_t ap = vec2_sub(p, a);
    vec2_t pc = vec2_sub(c, p);
    vec2_t pb = vec2_sub(b, p);

    // Compute the area of the full parallegram/triangle ABC using 2D cross product
    float area_parallelogram_abc = (ac.x * ab.y - ac.y * ab.x); // || AC x AB ||

    // Alpha is the area of the small parallelogram/triangle PBC divided by the area of the full parallelogram/triangle ABC
    float alpha = (pc.x * pb.y - pc.y * pb.x) / area_parallelogram_abc;

    // Beta is the area of the small parallelogram/triangle APC divided by the area of the full parallelogram/triangle ABC
    float beta = (ac.x * ap.y - ac.y * ap.x) / area_parallelogram_abc;

    // Weight gamma is easily found since barycentric coordinates always add up to 1.0
    float gamma = 1 - alpha - beta;

    vec3_t weights = {alpha, beta, gamma};
    return weights;
}
inline void int_swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}
inline void float_swap(float *a, float *b)
{
    float tmp = *a;
    *a = *b;
    *b = tmp;
}
inline float float_lerp(float a, float b, float t)
{
    return a + t * (b - a);
}

inline int mix_colors(int c_a, int c_b)
{
    // Extract the alpha, red, green, and blue components of each color
    int a1 = c_a >> 24;
    int r1 = (c_a >> 16) & 0xFF;
    int g1 = (c_a >> 8) & 0xFF;
    int b1 = c_a & 0xFF;
    int a2 = c_b >> 24;
    int r2 = (c_b >> 16) & 0xFF;
    int g2 = (c_b >> 8) & 0xFF;
    int b2 = c_b & 0xFF;

    // Mix the colors by averaging their alpha, red, green, and blue components
    int a = (a1 + a2) / 2;
    int r = (r1 + r2) / 2;
    int g = (g1 + g2) / 2;
    int b = (b1 + b2) / 2;

    // Combine the mixed alpha, red, green, and blue values into a single hexadecimal value
    return (a << 24) | (r << 16) | (g << 8) | b;
}