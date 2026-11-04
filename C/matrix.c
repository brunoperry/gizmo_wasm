#include "matrix.h"

mat4_t mat4_identity(void)
{
    return (mat4_t){{{1, 0, 0, 0},
                     {0, 1, 0, 0},
                     {0, 0, 1, 0},
                     {0, 0, 0, 1}}};
}

mat4_t mat4_make_scale(vec3_t s)
{
    mat4_t m = mat4_identity();
    m.m[0][0] = s.x;
    m.m[1][1] = s.y;
    m.m[2][2] = s.z;
    return m;
}

mat4_t mat4_make_translation(vec3_t t)
{
    mat4_t m = mat4_identity();
    m.m[0][3] = t.x;
    m.m[1][3] = t.y;
    m.m[2][3] = t.z;
    return m;
}

mat4_t mat4_make_rotation(vec3_t a)
{
    float cx = cosf(a.x), sx = sinf(a.x);
    float cy = cosf(a.y), sy = sinf(a.y);
    float cz = cosf(a.z), sz = sinf(a.z);

    mat4_t rx = mat4_identity();
    rx.m[1][1] = cx;
    rx.m[1][2] = -sx;
    rx.m[2][1] = sx;
    rx.m[2][2] = cx;

    mat4_t ry = mat4_identity();
    ry.m[0][0] = cy;
    ry.m[0][2] = sy;
    ry.m[2][0] = -sy;
    ry.m[2][2] = cy;

    mat4_t rz = mat4_identity();
    rz.m[0][0] = cz;
    rz.m[0][1] = -sz;
    rz.m[1][0] = sz;
    rz.m[1][1] = cz;

    return mat4_mul_mat4(rx, mat4_mul_mat4(ry, rz));
}

mat4_t mat4_mul_mat4(mat4_t a, mat4_t b)
{
    mat4_t m;
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 4; j++)
            m.m[i][j] = a.m[i][0] * b.m[0][j] + a.m[i][1] * b.m[1][j] + a.m[i][2] * b.m[2][j] + a.m[i][3] * b.m[3][j];
    return m;
}
