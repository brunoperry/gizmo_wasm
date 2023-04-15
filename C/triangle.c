#include "triangle.h"

void triangle_log(triangle_t t)
{
    log_triangle(t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z, t.c.x, t.c.y, t.c.z);
}