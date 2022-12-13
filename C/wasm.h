
#ifndef GIZMO_WASM
#define GIZMO_WASM

// This is used to flag a function as something that
// should be accessible in javascript.
#define EXPORT __attribute__((visibility("default")))

__attribute__((import_module("js"), import_name("console_log"))) float console_log(float line, float val);
__attribute__((import_module("js"), import_name("info_log"))) float info_log(int verts, float tris);

#endif