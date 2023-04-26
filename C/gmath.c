#include <stdbool.h>
#include "gmath.h"
#include "wasm.h"

///////////////////////////////////////////////////////////////////////////////
// Texture coordinates Implementations
///////////////////////////////////////////////////////////////////////////////
tex2_t tex2_clone(tex2_t *t)
{
    tex2_t result = {t->u, t->v};
    return result;
}
tex2_t tex2_new(float u, float v)
{
    return (tex2_t){u, v};
}
///////////////////////////////////////////////////////////////////////////////
// Vector 2D Implementations
///////////////////////////////////////////////////////////////////////////////
float vec2_length(vec2_t v)
{
    return sqrt(v.x * v.x + v.y * v.y);
}
vec2_t vec2_add(vec2_t a, vec2_t b)
{
    vec2_t result = {
        .x = a.x + b.x,
        .y = a.y + b.y};
    return result;
}
vec2_t vec2_sub(vec2_t a, vec2_t b)
{
    vec2_t result = {
        .x = a.x - b.x,
        .y = a.y - b.y};
    return result;
}
vec2_t vec2_mul(vec2_t v, float factor)
{
    vec2_t result = {
        .x = v.x * factor,
        .y = v.y * factor};
    return result;
}
vec2_t vec2_div(vec2_t v, float factor)
{
    vec2_t result = {
        .x = v.x / factor,
        .y = v.y / factor};
    return result;
}
float vec2_dot(vec2_t a, vec2_t b)
{
    return (a.x * b.x) + (a.y * b.y);
}
void vec2_normalize(vec2_t *v)
{
    float length = sqrt(v->x * v->x + v->y * v->y);
    v->x /= length;
    v->y /= length;
}

//////////////////////////////////////
// Vector 3D Implementations
//////////////////////////////////////
float vec3_length(vec3_t v)
{
    return sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
vec3_t vec3_add_vecs(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.x + b.x,
        .y = a.y + b.y,
        .z = a.z + b.z};
    return result;
}
vec3_t vec3_add_num(vec3_t a, float factor)
{
    vec3_t result = {
        .x = a.x + factor,
        .y = a.y + factor,
        .z = a.z + factor};
    return result;
}
vec3_t vec3_sub_vecs(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.x - b.x,
        .y = a.y - b.y,
        .z = a.z - b.z};
    return result;
}
vec3_t vec3_sub_num(vec3_t a, float factor)
{
    vec3_t result = {
        .x = a.x - factor,
        .y = a.y - factor,
        .z = a.z - factor};
    return result;
}
vec3_t vec3_mul_num(vec3_t v, float factor)
{
    vec3_t result = {
        .x = v.x * factor,
        .y = v.y * factor,
        .z = v.z * factor};
    return result;
}
vec3_t vec3_div_num(vec3_t v, float factor)
{
    vec3_t result = {
        .x = v.x / factor,
        .y = v.y / factor,
        .z = v.z / factor};
    return result;
}
vec3_t vec3_cross(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.y * b.z - a.z * b.y,
        .y = a.z * b.x - a.x * b.z,
        .z = a.x * b.y - a.y * b.x};
    return result;
}
float vec3_dot(vec3_t a, vec3_t b)
{
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}
void vec3_normalize(vec3_t *v)
{
    float length = sqrt(v->x * v->x + v->y * v->y + v->z * v->z);
    v->x /= length;
    v->y /= length;
    v->z /= length;
}
void vec3_negate(vec3_t *v)
{
    v->x = -v->x;
    v->y = -v->y;
    v->z = -v->z;
}
vec3_t vec3_clone(vec3_t *v)
{
    vec3_t result = {v->x, v->y, v->z};
    return result;
}
vec3_t vec3_new(float x, float y, float z)
{
    return (vec3_t){.x = x, .y = y, .z = z};
}
void vec3_log(vec3_t v)
{
    log_vec3(v.x, v.y, v.z);
}

//////////////////////////////////////
// Vector 4D Implementations
//////////////////////////////////////
vec4_t vec4_new(float x, float y, float z, float w)
{
    return (vec4_t){.x = x, .y = y, .z = z, .w = w};
}
vec4_t vec4_clone(vec4_t *v)
{
    vec4_t result = {v->x, v->y, v->z, v->w};
    return result;
}
vec3_t vec4_divide_scalar(vec4_t vector, float scalar)
{
    vec3_t result;
    result.x = vector.x / scalar;
    result.y = vector.y / scalar;
    result.z = vector.z / scalar;
    return result;
}
vec3_t vec4_divide_scalar_2d(vec4_t vector, float scalar)
{
    vec3_t result;
    result.x = vector.x / scalar;
    result.y = vector.y / scalar;
    result.z = vector.y / scalar;
    return result;
}
vec4_t vec4_div_equals_num(vec4_t vec, float num)
{
    vec4_t out;
    out.x = vec.x / num;
    out.y = vec.y / num;
    out.z = vec.z / num;
    out.w = 1;
    return out;
}
void vec4_log(vec4_t v)
{
    log_vec4(v.x, v.y, v.z, v.w);
}

//////////////////////////////////////
// Matrix Implementations
//////////////////////////////////////
mat4_t mat4_identity(void)
{
    // | 1 0 0 0 |
    // | 0 1 0 0 |
    // | 0 0 1 0 |
    // | 0 0 0 1 |
    mat4_t m = {{{1, 0, 0, 0},
                 {0, 1, 0, 0},
                 {0, 0, 1, 0},
                 {0, 0, 0, 1}}};
    return m;
}
mat4_t mat4_from_buffer(float *b)
{
    mat4_t m = {{{b[0], b[1], b[2], b[3]},
                 {b[4], b[5], b[6], b[7]},
                 {b[8], b[9], b[10], b[11]},
                 {b[12], b[13], b[14], b[15]}}};
    return m;
}
mat4_t mat4_mul_mat4(mat4_t a, mat4_t b)
{
    mat4_t m;
    for (int i = 0; i < 4; i++)
    {
        for (int j = 0; j < 4; j++)
        {
            m.m[i][j] = a.m[i][0] * b.m[0][j] + a.m[i][1] * b.m[1][j] + a.m[i][2] * b.m[2][j] + a.m[i][3] * b.m[3][j];
        }
    }
    return m;
}
vec4_t mat4_mul_vec4(mat4_t m, vec4_t v)
{
    vec4_t result;
    result.x = m.m[0][0] * v.x + m.m[0][1] * v.y + m.m[0][2] * v.z + m.m[0][3] * v.w;
    result.y = m.m[1][0] * v.x + m.m[1][1] * v.y + m.m[1][2] * v.z + m.m[1][3] * v.w;
    result.z = m.m[2][0] * v.x + m.m[2][1] * v.y + m.m[2][2] * v.z + m.m[2][3] * v.w;
    result.w = m.m[3][0] * v.x + m.m[3][1] * v.y + m.m[3][2] * v.z + m.m[3][3] * v.w;

    return result;
}
vec3_t mat4_mul_vec3(mat4_t m, vec3_t v)
{
    vec3_t result;
    result.x = m.m[0][0] * v.x + m.m[0][1] * v.y + m.m[0][2] * v.z;
    result.y = m.m[1][0] * v.x + m.m[1][1] * v.y + m.m[1][2] * v.z;
    result.z = m.m[2][0] * v.x + m.m[2][1] * v.y + m.m[2][2] * v.z;

    return result;
}
vec4_t mat4_project_vec4(mat4_t mvp, vec4_t vec)
{
    // Perform perspective division
    vec4_t projectedVertex = perspective_divide(vec);

    // Perform viewport transformation
    int width = 320;
    int height = 240;
    float halfWidth = width / 2.0f;
    float halfHeight = height / 2.0f;
    float x = halfWidth * (projectedVertex.x / projectedVertex.w + 1.0f);
    float y = halfHeight * (1.0f - projectedVertex.y / projectedVertex.w);
    float z = projectedVertex.z / projectedVertex.w;

    return vec4_new(x, y, z, vec.w);
}
triangle_t mat4_project_triangle(mat4_t mvp, triangle_t tri)
{
}
void mat4_log(mat4_t m)
{
    log_matrix(m.m[0][0], m.m[0][1], m.m[0][2], m.m[0][3], m.m[1][0], m.m[1][1], m.m[1][2], m.m[1][3], m.m[2][0], m.m[2][1], m.m[2][2], m.m[2][3], m.m[3][0], m.m[3][1], m.m[3][2], m.m[3][3]);
}

//////////////////////////////////////
// Vector conversion funcs
//////////////////////////////////////
vec4_t vec4_from_vec3(vec3_t v)
{
    vec4_t result = {v.x, v.y, v.z, 1.0};
    return result;
}
vec3_t vec3_from_vec4(vec4_t v)
{
    vec3_t result = {v.x, v.y, v.z};
    return result;
}
vec3_t vec3_from_buffer(float *b)
{
    vec3_t result = {b[0],
                     b[1],
                     b[2]};
    return result;
}
vec2_t vec2_from_vec4(vec4_t v)
{
    vec2_t result = {v.x, v.y};
    return result;
}

//////////////////////////////////////
// Math
//////////////////////////////////////
int min(int a, int b)
{
    return a < b ? a : b;
}
int max(int a, int b)
{
    return a > b ? a : b;
}

// bool is_inside_triangle(const vec3_t &barycentric)
// {
//     return barycentric.x >= 0 && barycentric.y >= 0 && barycentric.z >= 0;
// }
//////////////////////////////////////
// Utils
//////////////////////////////////////
vec4_t perspective_divide(vec4_t vertex)
{
    return vec4_new(vertex.x /= vertex.w, vertex.y /= vertex.w, vertex.z /= vertex.w, vertex.w);
}
vec3_t barycentric_weights(vec2_t a, vec2_t b, vec2_t c, vec2_t p)
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
void int_swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}
void float_swap(float *a, float *b)
{
    float tmp = *a;
    *a = *b;
    *b = tmp;
}
float float_lerp(float a, float b, float t)
{
    return a + t * (b - a);
}

int mix_colors(int c_a, int c_b)
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