
#ifndef GIZMO_WASM
#define GIZMO_WASM

// This is used to flag a function as something that
// should be accessible in javascript.
#define EXPORT __attribute__((visibility("default")))

__attribute__((import_module("js"), import_name("console_log"))) float console_log(float line, float val);
__attribute__((import_module("js"), import_name("info_log"))) float info_log(int verts, float tris);
__attribute__((import_module("js"), import_name("float_log"))) float float_log(float value);
__attribute__((import_module("js"), import_name("int_log"))) float int_log(float value);
__attribute__((import_module("js"), import_name("vec3_log"))) float wasm_vec3_log(float x, float y, float z);
__attribute__((import_module("js"), import_name("vec4_log"))) float wasm_vec4_log(float x, float y, float z, float w);
__attribute__((import_module("js"), import_name("mat4_log"))) float wasm_mat4_log(float a0, float a1, float a2, float a3, float b0, float b1, float b2, float b3, float c0, float c1, float c2, float c3, float d0, float d1, float d2, float d3);

#endif