# **Gizmo Engine** _(wasm)_

![picture alt](https://raw.githubusercontent.com/brunoperry/gizmo_wasm/abb66453287b98c92e93509901a187b34347bade/placeholder.png "Gizmo engine readme placeholder")

## About

3D software renderer written in C, compiled to wasm _(via wasi)_ and controlled by Javascript. Its an hobby project for learning purposes only.

## Features

- OBJ model loader _(mesh data only)_
- Z-buffering
- Flat shading _(directional lighting)_
- Wireframe, shaded and textured render modes

## Check it

**[https://brunoperry.github.io/gizmo_wasm/web/](https://brunoperry.github.io/gizmo_wasm/web/ "https://brunoperry.github.io/gizmo_wasm/web/")**

## Test it

Clone the repo and run index.html on localhost, no dependencies needed.

## Trying out different models

Open the `/web/resources/data.json` file and add/edit your new object _(name, url, texture)_. Also include/edit your new texture _(name, url)_.

Next, open the `script.js` file, change the Demo class to add your new model to the scene _(line 50)_.

## Development

Make sure you have wasi installed then update your `.makefile --sysroot` directory accordingly _(line 9)_.

- WASI -> **_[https://wasi.dev](https://wasi.dev "https://wasi.dev")_**

I'm developing this project on MacOs _(Ventura)_ and testing with chromium. If you have a different environment, it may not compile/work properly :(

## Bugs

A lot of them. The most noticable being:

- x clipping.
- Frame rate below 60.
- Camera not working properly _(using eulars)_.
- "Monkey Pressing" play/pause button messes with cursor lock.
- ...

Have fun!
