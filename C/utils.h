#ifndef M_PI
// clang-format off
#define M_PI     3.141592653589
#define M_PI2    6.283185307179
#define M_PI_SQR 9.869604401089
#define M_PID2   1.570796326794
// clang-format on
#endif

#ifndef GMATH_H
#define GMATH_H

#include <math.h>
#include <stdint.h>
#include "vector.h"
#include "wasm.h"

///////////////////////////////////////////////////////////////////////////////
// Utils funcs
///////////////////////////////////////////////////////////////////////////////
vec3_t barycentric_weights(vec2_t a, vec2_t b, vec2_t c, vec2_t p);
void int_swap(int *a, int *b);
void float_swap(float *a, float *b);
float float_lerp(float a, float b, float t);
int mix_colors(int c_a, int c_b);

#endif