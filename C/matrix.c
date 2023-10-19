#include "matrix.h"

//////////////////////////////////////
// Matrix Implementations
//////////////////////////////////////
inline mat4_t mat4_identity(void)
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
inline mat4_t mat4_make_scale(float sx, float sy, float sz)
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
inline mat4_t mat4_make_translation(vec3_t t)
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

inline mat4_t mat4_make_rotation(vec3_t rot)
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
inline mat4_t mat4_make_rotation_x(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
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
inline mat4_t mat4_make_rotation_y(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
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
inline mat4_t mat4_make_rotation_z(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
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
inline mat4_t mat4_mul_mat4(mat4_t a, mat4_t b)
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
inline vec4_t mat4_mul_vec4(mat4_t m, vec4_t v)
{

    vec4_t result;
    result.x = m.m[0][0] * v.x + m.m[0][1] * v.y + m.m[0][2] * v.z + m.m[0][3] * v.w;
    result.y = m.m[1][0] * v.x + m.m[1][1] * v.y + m.m[1][2] * v.z + m.m[1][3] * v.w;
    result.z = m.m[2][0] * v.x + m.m[2][1] * v.y + m.m[2][2] * v.z + m.m[2][3] * v.w;
    result.w = m.m[3][0] * v.x + m.m[3][1] * v.y + m.m[3][2] * v.z + m.m[3][3] * v.w;

    return result;
}
inline vec3_t mat4_mul_vec3(mat4_t m, vec3_t v)
{
    vec3_t result;
    result.x = m.m[0][0] * v.x + m.m[0][1] * v.y + m.m[0][2] * v.z;
    result.y = m.m[1][0] * v.x + m.m[1][1] * v.y + m.m[1][2] * v.z;
    result.z = m.m[2][0] * v.x + m.m[2][1] * v.y + m.m[2][2] * v.z;

    return result;
}
inline mat4_t mat4_make_perspective(float fov, float aspect, float znear, float zfar)
{
    // | (h/w)*1/tan(fov/2)             0              0                 0 |
    // |                  0  1/tan(fov/2)              0                 0 |
    // |                  0             0     zf/(zf-zn)  (-zf*zn)/(zf-zn) |
    // |                  0             0              1                 0 |
    mat4_t m = {{{0}}};
    m.m[0][0] = aspect * (1 / tan(fov / 2));
    m.m[1][1] = 1 / tan(fov / 2);
    m.m[2][2] = zfar / (zfar - znear);
    m.m[2][3] = (-zfar * znear) / (zfar - znear);
    m.m[3][2] = 1.0;
    return m;
}
inline vec4_t mat4_mul_vec4_project(mat4_t mat_proj, vec4_t v)
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
inline mat4_t mat4_look_at(vec3_t eye, vec3_t center, vec3_t up)
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

    return view_matrix;
}
inline void mat4_log(mat4_t mat)
{
    wasm_mat4_log(
        mat.m[0][0], mat.m[0][1], mat.m[0][2], mat.m[0][3],
        mat.m[1][0], mat.m[1][1], mat.m[1][2], mat.m[1][3],
        mat.m[2][0], mat.m[2][1], mat.m[2][2], mat.m[2][3],
        mat.m[3][0], mat.m[3][1], mat.m[3][2], mat.m[3][3]);
}