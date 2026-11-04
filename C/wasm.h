#ifndef GIZMO_WASM
#define GIZMO_WASM

// Exports a function to javascript under its own name:
//   EXPORT(update) void update(void) { ... }
#define EXPORT(name) __attribute__((export_name(#name)))

// Functions implemented in javascript (see web/src/WASM.js).
__attribute__((import_module("js"), import_name("console_log"))) float console_log(float line, float val);
__attribute__((import_module("js"), import_name("info_log"))) float info_log(int tris, float verts);
__attribute__((import_module("js"), import_name("float_log"))) float float_log(float value);
__attribute__((import_module("js"), import_name("int_log"))) float int_log(float value);
__attribute__((import_module("js"), import_name("vec3_log"))) float wasm_vec3_log(float x, float y, float z);

#endif
