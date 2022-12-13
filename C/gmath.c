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
vec3_t vec3_add(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.x + b.x,
        .y = a.y + b.y,
        .z = a.z + b.z};
    return result;
}
vec3_t vec3_sub(vec3_t a, vec3_t b)
{
    vec3_t result = {
        .x = a.x - b.x,
        .y = a.y - b.y,
        .z = a.z - b.z};
    return result;
}
vec3_t vec3_mul(vec3_t v, float factor)
{
    vec3_t result = {
        .x = v.x * factor,
        .y = v.y * factor,
        .z = v.z * factor};
    return result;
}
vec3_t vec3_div(vec3_t v, float factor)
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
vec3_t vec3_rotate_x(vec3_t v, float angle)
{
    vec3_t rotated_vector = {
        .x = v.x,
        .y = v.y * g_cos(angle) - v.z * g_sin(angle),
        .z = v.y * g_sin(angle) + v.z * g_cos(angle)};
    return rotated_vector;
}
vec3_t vec3_rotate_y(vec3_t v, float angle)
{
    vec3_t rotated_vector = {
        .x = v.x * g_cos(angle) + v.z * g_sin(angle),
        .y = v.y,
        .z = -v.x * g_sin(angle) + v.z * g_cos(angle)};
    return rotated_vector;
}
vec3_t vec3_rotate_z(vec3_t v, float angle)
{
    vec3_t rotated_vector = {
        .x = v.x * g_cos(angle) - v.y * g_sin(angle),
        .y = v.x * g_sin(angle) + v.y * g_cos(angle),
        .z = v.z};
    return rotated_vector;
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
mat4_t mat4_make_scale(float sx, float sy, float sz)
{
    // | sx  0  0  0 |
    // |  0 sy  0  0 |
    // |  0  0 sz  0 |
    // |  0  0  0  1 |
    mat4_t m = mat4_identity();
    m.m[0][0] = sx;
    m.m[1][1] = sy;
    m.m[2][2] = sz;
    return m;
}
mat4_t mat4_make_translation(vec3_t t)
{
    // | 1  0  0  tx |
    // | 0  1  0  ty |
    // | 0  0  1  tz |
    // | 0  0  0  1  |
    mat4_t m = mat4_identity();
    m.m[0][3] = t.x;
    m.m[1][3] = t.y;
    m.m[2][3] = t.z;
    return m;
}

mat4_t mat4_make_rotation(vec3_t rot)
{
    mat4_t m = mat4_identity();

    mat4_t rotation_matrix_x = mat4_make_rotation_x(rot.x);
    mat4_t rotation_matrix_y = mat4_make_rotation_y(rot.y);
    mat4_t rotation_matrix_z = mat4_make_rotation_z(rot.z);

    m = mat4_mul_mat4(rotation_matrix_z, m);
    m = mat4_mul_mat4(rotation_matrix_y, m);
    m = mat4_mul_mat4(rotation_matrix_x, m);

    return m;
}
mat4_t mat4_make_rotation_x(float angle)
{
    float c = g_cos(angle);
    float s = g_sin(angle);
    // | 1  0  0  0 |
    // | 0  c -s  0 |
    // | 0  s  c  0 |
    // | 0  0  0  1 |
    mat4_t m = mat4_identity();
    m.m[1][1] = c;
    m.m[1][2] = -s;
    m.m[2][1] = s;
    m.m[2][2] = c;
    return m;
}
mat4_t mat4_make_rotation_y(float angle)
{
    float c = g_cos(angle);
    float s = g_sin(angle);
    // |  c  0  s  0 |
    // |  0  1  0  0 |
    // | -s  0  c  0 |
    // |  0  0  0  1 |
    mat4_t m = mat4_identity();
    m.m[0][0] = c;
    m.m[0][2] = s;
    m.m[2][0] = -s;
    m.m[2][2] = c;
    return m;
}
mat4_t mat4_make_rotation_z(float angle)
{
    float c = g_cos(angle);
    float s = g_sin(angle);
    // | c -s  0  0 |
    // | s  c  0  0 |
    // | 0  0  1  0 |
    // | 0  0  0  1 |
    mat4_t m = mat4_identity();
    m.m[0][0] = c;
    m.m[0][1] = -s;
    m.m[1][0] = s;
    m.m[1][1] = c;
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
mat4_t mat4_make_perspective(float fov, float aspect, float znear, float zfar)
{
    // | (h/w)*1/tan(fov/2)             0              0                 0 |
    // |                  0  1/tan(fov/2)              0                 0 |
    // |                  0             0     zf/(zf-zn)  (-zf*zn)/(zf-zn) |
    // |                  0             0              1                 0 |
    mat4_t m = {{{0}}};
    m.m[0][0] = aspect * (1 / g_tan(fov / 2));
    m.m[1][1] = 1 / g_tan(fov / 2);
    m.m[2][2] = zfar / (zfar - znear);
    m.m[2][3] = (-zfar * znear) / (zfar - znear);
    m.m[3][2] = 1.0;
    return m;
}
vec4_t mat4_mul_vec4_project(mat4_t mat_proj, vec4_t v)
{
    // multiply the projection matrix by our original vector
    vec4_t result = mat4_mul_vec4(mat_proj, v);

    // perform perspective divide with original z-value that is now stored in w
    if (result.w != 0.0)
    {
        result.x /= result.w;
        result.y /= result.w;
        result.z /= result.w;
    }
    return result;
}

mat4_t mat4_look_at(vec3_t eye, vec3_t center, vec3_t up)
{
    mat4_t view_matrix = mat4_identity();

    vec3_t forward = vec3_sub(eye, center);
    // vec3_normalize(&forward);
    vec3_t right = vec3_cross(up, forward);
    vec3_normalize(&right);
    vec3_t newup = vec3_cross(forward, right);

    view_matrix.m[0][0] = right.x;
    view_matrix.m[0][1] = right.y;
    view_matrix.m[0][2] = right.z;
    view_matrix.m[0][3] = 0;
    view_matrix.m[1][0] = newup.x;
    view_matrix.m[1][1] = newup.y;
    view_matrix.m[1][2] = newup.z;
    view_matrix.m[1][3] = 0;
    view_matrix.m[2][0] = forward.x;
    view_matrix.m[2][1] = forward.y;
    view_matrix.m[2][2] = forward.z;
    view_matrix.m[2][3] = 0;
    view_matrix.m[3][0] = eye.x;
    view_matrix.m[3][1] = eye.y;
    view_matrix.m[3][2] = eye.z;
    view_matrix.m[3][3] = 1;

    return view_matrix;

    vec3_t pos = vec3_clone(&eye);
    vec3_negate(&pos);

    float x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    float eyex = eye.x;
    float eyey = eye.y;
    float eyez = eye.z;
    float upx = up.x;
    float upy = up.y;
    float upz = up.z;
    float centerx = center.x;
    float centery = center.y;
    float centerz = center.z;

    if (
        fabs(eyex - centerx) < 0.000001 &&
        fabs(eyey - centery) < 0.000001 &&
        fabs(eyez - centerz) < 0.000001)
    {
        return mat4_identity();
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len)
    {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    }
    else
    {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len)
    {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    }
    else
    {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    view_matrix.m[0][0] = x0;
    view_matrix.m[1][0] = y0;
    view_matrix.m[2][0] = z0;
    view_matrix.m[3][0] = 0;
    view_matrix.m[0][1] = x1;
    view_matrix.m[1][1] = y1;
    view_matrix.m[2][1] = z1;
    view_matrix.m[3][1] = 0;
    view_matrix.m[0][2] = x2;
    view_matrix.m[1][2] = y2;
    view_matrix.m[2][2] = z2;
    view_matrix.m[3][2] = 0;
    view_matrix.m[0][3] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    view_matrix.m[1][3] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    view_matrix.m[2][3] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    view_matrix.m[3][3] = 1;

    // view_matrix.m[0][0] = x0;
    // view_matrix.m[0][1] = y0;
    // view_matrix.m[0][2] = z0;
    // view_matrix.m[0][3] = 0;
    // view_matrix.m[1][0] = x1;
    // view_matrix.m[1][1] = y1;
    // view_matrix.m[1][2] = z1;
    // view_matrix.m[1][3] = 0;
    // view_matrix.m[2][0] = x2;
    // view_matrix.m[2][1] = y2;
    // view_matrix.m[2][2] = z2;
    // view_matrix.m[2][3] = 0;
    // view_matrix.m[3][0] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    // view_matrix.m[3][1] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    // view_matrix.m[3][2] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    // view_matrix.m[3][3] = 1;

    return view_matrix;
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
vec2_t vec2_from_vec4(vec4_t v)
{
    vec2_t result = {v.x, v.y};
    return result;
}

//////////////////////////////////////
// Math
//////////////////////////////////////
float g_aTan2(float y, float x)
{
    float coeff_1 = M_PI / 4;
    float coeff_2 = 3 * coeff_1;
    float abs_y = fabsf(y);
    float angle;
    if (x >= 0)
    {
        float r = (x - abs_y) / (x + abs_y);
        angle = coeff_1 - coeff_1 * r;
    }
    else
    {
        float r = (x + abs_y) / (abs_y - x);
        angle = coeff_2 - coeff_1 * r;
    }
    return y < 0 ? -angle : angle;
}
float g_cos(float x)
{
    float p = x / M_PI2;
    float r = p - .25 - floor(p + .25);
    float y = r * 16 * (fabsf(r) - 0.5);
    return y;
}
float g_sin(float x)
{
    return g_cos(x - M_PID2);
}
float g_tan(float x)
{
    return g_sin(x) / g_cos(x);
}

int g_abs(int n)
{
    int out = n;
    if (n < 0)
    {
        out = (-1) * n;
    }

    return out;
}
float g_fabs(float n)
{
    float out = n;
    if (n < 0)
    {
        out = (-1) * n;
    }

    return out;
}
//////////////////////////////////////
// Utils
//////////////////////////////////////
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