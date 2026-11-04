# **Gizmo Engine** _(wasm)_

![picture alt](https://raw.githubusercontent.com/brunoperry/gizmo_wasm/abb66453287b98c92e93509901a187b34347bade/placeholder.png "Gizmo wasm screenshot")

## About

3D software renderer written in C, compiled to wasm _(via wasi)_ and controlled by Javascript. Its an hobby project for learning purposes only.

## Features

- OBJ model loader _(mesh data only)_
- Z-buffering
- Flat shading _(directional lighting)_
- Wireframe, shaded and textured render modes

## Check it out

**[https://brunoperry.github.io/gizmo_wasm/web/](https://brunoperry.github.io/gizmo_wasm/web/ "https://brunoperry.github.io/gizmo_wasm/web/")**

## Test it

Clone the repo and run index.html on localhost, no dependencies needed.

## Playing with different models

Open the `/web/resources/data.json` file and add/edit your new object _(name, url, texture)_. Also include/edit your new texture _(name, url)_.

Next, open `web/src/TestScene.js` and add your new model to the scene.

## Development

You need the [WASI SDK](https://github.com/WebAssembly/wasi-sdk/releases) (tested with 25.0). Point the makefile at it and build:

```sh
make build WASI_SDK=/path/to/wasi-sdk    # optimized -> web/src/gizmo.wasm
make debug WASI_SDK=/path/to/wasi-sdk    # -O0 with DWARF debug info
```

`WASI_SDK` defaults to `~/libs/wasi-sdk-25.0-x86_64-macos`. The module has no WASI imports (it uses its own bump allocator instead of `malloc`), so it runs in any browser with WebAssembly SIMD support.

### How it renders

- Each object is a triangle soup (9 floats/triangle) written by JS straight into wasm memory.
- Per frame: one model-view matrix per object, back-face culling, frustum clipping only for triangles that cross a plane, then rasterization.
- The rasterizer is a scanline rasterizer with a top-left fill rule. Depth (1/w) and u/w, v/w are stepped per pixel; textures are perspective-corrected every 16 pixels and interpolated in 16.16 fixed point in between.

## Known issues

- No mobile support.

Have fun!
