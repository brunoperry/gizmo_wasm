
#ifndef GIZMO_WASM
#define GIZMO_WASM

// This is used to flag a function as something that
// should be accessible in javascript.
#define EXPORT __attribute__((visibility("default")))

__attribute__((import_module("js"), import_name("console_log"))) float console_log(float line, float val);
__attribute__((import_module("js"), import_name("info_log"))) float info_log(int verts, float tris);
__attribute__((import_module("js"), import_name("log_matrix"))) float log_matrix(float a, float b, float c, float d, float e, float f, float g, float h, float i, float j, float k, float l, float m, float n, float o, float p);

__attribute__((import_module("js"), import_name("log_triangle"))) float log_triangle(float ax, float ay, float az, float bx, float by, float bz, float cx, float cy, float cz);
__attribute__((import_module("js"), import_name("log_vec3"))) float log_vec3(float vx, float vy, float vz);
__attribute__((import_module("js"), import_name("log_vec4"))) float log_vec4(float vx, float vy, float vz, float vw);
__attribute__((import_module("js"), import_name("log_float"))) float log_float(float f);

#endif