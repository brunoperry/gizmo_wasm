# **Gizmo Engine** _(wasm)_

![picture alt](https://raw.githubusercontent.com/brunoperry/gizmo_wasm/abb66453287b98c92e93509901a187b34347bade/placeholder.png "Gizmo engine readme placeholder")

## About

3D software renderer written in C, compiled to wasm (via wasi) and controlled by Javascript. Its an hobby project for learning purposes only.

## Features

- OBJ model loader (mesh only)
- Z-buffering
- Flat shading (directional lighting)
- Wireframe, shaded and textured render modes

## Test it

Run index.html on localhost, no dependencies needed.

## Try out different models

Open the `/web/resources/data.json` file and add/edit your new object (name, url, texture). Also include/edit your new texture (name, url).

Next, open the `script.js` file, change the Demo class and add your new model to the scene (line 50).

## Development

Make sure you have wasi installed then update your .makefile --sysroot directory (line 9).

- WASI -> **_[https://wasi.dev](https://wasi.dev "https://wasi.dev")_**

I'm developing this project on MacOs (Ventura) and testing with chromium. If you have a different environment, it may not compile/work properly :(

## Bugs

A lot of them. The most noticable being:

- x clipping.
- Frame rate below 60.
- ...

Have fun!
