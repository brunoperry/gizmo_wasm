# Gizmo WASM

A 3D software renderer (the Gizmo engine) plus the apps built on it. There are no dependencies: serve the repo root on localhost and open `/apps/viewer/`.

## Layout
- `engine/C/`: the renderer in C, compiled to `engine/js/gizmo.wasm`.
- `engine/js/`: the engine's JS side. `index.js` is its public API; the other modules are internal.
- `apps/viewer/`: the model viewer (menus, HUD, `ModelScene`, `TestScene`, its `resources/` with `data.json`).
- `index.html` (root) redirects to `apps/viewer/`.
- Rules:
  - The engine never imports from `apps/`.
  - Apps import the engine as `"gizmo"` (or `"gizmo/<module>.js"`) through an import map in their `index.html`.
  - The plan is to split `engine/` into its own repo once its API settles (`git subtree split`); then only the import map changes.
- Engine API for apps:
  - `engine.start_engine(SceneClass, { canvas, data, pointer_lock })`: `data` is the app's resource list, and its urls are relative to the file. `pointer_lock` makes `play()` lock the mouse, and losing the lock stops the loop. It is off by default; the viewer turns it on.
  - `engine.load_scene(build)`: swaps scenes and frees wasm memory. SCENE_CHANGED gets the new scene.
  - `WASM.initialize` loads `gizmo.wasm` next to `WASM.js` (`import.meta.url`).
  - `Engine.States.RENDERED` fires after every render with `WASM.stats` (`{ tris, verts }`, from C `info_log`). It replaced the global "wasm_info" document event.
  - The camera (`Camera3D`) reads no input. It has position, direction, `yaw`/`pitch` + `set_angles`, `frame_all(immediate)` and its glide (`update`).
    - Input lives in optional controls: `scene.controls`, updated before `camera.update`. `FlyControls` is the editor-like one: mouse look, W A S D, F to frame all.
    - The viewer attaches FlyControls to every scene (READY / SCENE_CHANGED). A camera trace of 76 frames with keys and mouse matched the old built-in behavior exactly.
  - `new Scene(name, { default_light })`: the 0.7 directional default light is on unless `false`.
  - The grid is off by default in the engine; the viewer turns it on.
  - Audio (`AudioControler.js`/`AudioTrack.js`) is an unfinished music-player design, left untouched. It is to be redesigned for games (engine sounds, effects) with Marginal.

## Working with the user
- Reply in European Portuguese.
- The user makes their own commits. Never commit or push unless asked.
- Performance is a top priority. Measure before and after when changing hot paths (raster, renderer, shadows, skinning).
- Leave `apps/viewer/src/TestScene.js` alone unless asked; it's the user's playground scene.

## Build
- `make build`: wasi-sdk 25, target `wasm32-wasip1`, `-O3 -ffast-math -msimd128`.
  - The SDK path defaults to `$(HOME)/libs/wasi-sdk-25.0-arm64-macos` on Apple Silicon and `…-x86_64-macos` on Intel (picked from `uname -m`). Override it with `make build WASI_SDK=/path`.
- `make debug`: -O0 build with DWARF debug info.
- `gizmo.wasm` is committed (and also listed in .gitignore). Rebuild it after any C change.
- Under `-ffast-math`:
  - don't use `INFINITY` (use `1e30f`);
  - don't rely on NaN checks;
  - clamp absurd inputs instead.
- Memory comes from a bump allocator, `gz_alloc` (engine/C/memory.c). Nothing is freed one by one: `gz_release(mark)` drops everything after a `gz_mark()` (used to unload scenes, see below).
- When the wasm memory grows, JS views onto `WASM.mem` go stale. Create typed-array views on demand; don't keep them.

## Conventions (easy to get wrong)
- **World space** is right-handed. View space is mirrored, so in view space the outward face normal is `-cross(b-a, c-a)`. Counter-clockwise triangles face out.
- **Matrices** are row-major and multiply column vectors (`p' = M·p`). USD matrices are transposed on import (`from_usd_matrix` in USDA.js).
- **Display buffer:** each uint32 pixel is `A<<24 | B<<16 | G<<8 | R`.
- **Meshes** are triangle soup: every triangle corner has its own vertex, uv and normal. `Object3D.from_faces` builds it from (point, uv, normal) index triplets.
- **Normals:** when a file has no normals, they are computed at load time (`engine/js/Normals.js`). Edges sharper than the crease angle stay hard (60° by default; a `"crease_angle"` in a data.json entry overrides it). Points at the same position are welded.
- **Render settings** are 5 ints written by JS: render mode, lighting mode (TRIANGLE / VERTEX / PIXEL), show light gizmos, shadows, show grid.
- **Lights:** up to 8. They live in a float block: a 4-float header (count, ambient rgb), then 16 floats per light (see `engine/C/light3d.h`). Lighting is evaluated in view space.
- **Shadows:**
  - directional lights use an ortho 512 map fitted to object bounds;
  - spot lights use a perspective 512 map;
  - point lights use a 6×256 cube;
  - lookups use 2×2 PCF with normal-offset bias;
  - maps are cached by a hash of light params, object transforms and `deform_version`.
- **Animation (UsdSkel):**
  - JS (`Animator.js`) writes 3 floats per animator: `[frame_a, frame_b, weight_b]`.
  - C (`skeleton.c`) samples the frames with nlerp and crossfades.
  - C (`skinning.c`) then skins with dual quaternions or linear blending.
  - skin matrix = to_object · global · inv_bind.
  - Skinning updates bounds and bumps `deform_version`.
- **First frame:** the engine draws nothing before the first frame is shown (`play`, `playOnce` or `load_scene`). After that, setting changes redraw while paused. Headless tests open `/apps/viewer/` and click `#next` once to get a frame.

## USD loader (`engine/js/USDA.js`)
- Supports `.usda` only. A data.json entry name holds all of a file's meshes: use `Resources.get_objects(name)`, and `get_object(primName)` for a single mesh.
- Supported:
  - xformOps (rotate orders use the (x, y, z) values per axis; the op name only gives the order), upAxis Z;
  - variants, primvars (indexed or not), leftHanded orientation, holes;
  - UsdPreviewSurface/UsdUVTexture materials, GeomSubsets;
  - UsdSkel, including `skel:joints`, geomBindTransform and an inherited skeleton binding.
- Validate changes against Pixar's library. Install it with `python3.12 -m pip install usd-core`; python 3.15 has no wheel.
  - Geometry: compare the mesh points against `pxr` (`UsdGeom`).
  - Skinning: compare against `UsdSkel.SkinningQuery.ComputeSkinnedPoints` × the skeleton's world transform. The last check matched to about 6e-6.

## Status and pending work (as of 2026-11-08)
Done:
- usda loader;
- point, spot and directional lights, plus per-triangle/vertex/pixel modes;
- shadows;
- smoothed camera controls (`FlyControls`), with "frame all" on the F key (`Camera3D.frame_all`, using the world bounds from `scene_bounds` in engine/C/gizmo.c);
- skeletal animation with clips and crossfades;
- normals computed at load time;
- inkeeper texture resized to 512² (`inkeeper_map.jpg`).

UI redesign (in progress, driven by the user):
- A menu bar replaces the old control rows: Scene > Models, Shading > Modes (triangle/vertex/pixel) + Wireframe + Textured, Lighting > Lights/Shadows, Display > Grid/HUD, Filters > Barrel/Fisheye.
- Font: Fixedsys Excelsior (`apps/viewer/resources/font.woff`, a pixel font, regular only), loaded by `@font-face` in `apps/viewer/styles.css` and used through `--font`, with the system monospace as fallback.
  - Use it at 16px (or multiples) with `font-synthesis: none` and no bold, or it blurs.
  - It lacks ✓ and ▶, so the menus use √ and • and a CSS triangle.
- While Wireframe is on, Textured is disabled but remembers its state for when wireframe is turned off.
- **Grid** (`render_grid` in engine/C/renderer.c): lines one unit apart on world y = 0, around the camera, fading out between view depth 6 and 24. Drawn after the objects with a depth test (`raster_line_depth`, no depth write); in wireframe mode, before them. The clear color is translucent, so fading uses a straight-alpha "over" (a per-color table over the clear color). Costs ~0.1 ms per frame.
- **HUD** (`#hud`, a `<dl>` over the canvas inside `#canvas-container`): scene, FPS, verts, tris, memory, camera position and rotation (`Camera3D.rotation`, degrees, like `Object3D.rotation`). script.js refreshes it on every "wasm_info" event, only while it's visible.
- The grid is on by default; the HUD is hidden.
- The components are in `apps/viewer/src/GizmoMenu.js` (`<gizmo-menubar>`, `<gizmo-menu>`, `<gizmo-menu-item type="checkbox|radio">`, event `menuselect`). `UI.js` turns menu choices into `UI.Actions` and sets the check marks from the engine's state.
- **Loading scenes** (`Engine.load_scene(build)`):
  - Models load lazily: `Resources.initialize` only reads data.json and loads the entries with `"preload": true` (inkeeper, which TestScene uses synchronously). `Resources.load_model(name)` loads one (once; cached as JS data with its images), then `get_objects(name)` works; before that it throws a clear error.
  - Textures live in wasm per scene: `Object3D.texture` is a JS image (`{ name, width, height, data }`), and `Scene.add_obj3d` gets its wasm id from `Resources.texture_id(image)` (uploaded on first use in the scene).
  - At startup, after `Display`, JS calls `WASM.scene_begin()` (C `scene_begin`: a heap mark). Everything allocated after it belongs to the scene: camera, lights, objects, skeletons/animators, textures, and shadow/filter maps created later.
  - `scene_clear()` releases all of it (each module drops what is past the mark: `textures_release`, `skeletons_release`, `shadows_release`, `display_release`) and `Resources.scene_cleared()` forgets the textures; then the new scene is built. `gz_alloc` zeroes reused memory, so switching models gives the same image and wasm memory doesn't grow.
  - Scene > Models → `load_model(name)` in apps/viewer/script.js (async: `Resources.load_model`, then `engine.load_scene`) → `ModelScene` (apps/viewer/src/ModelScene.js: its lights, camera `frame_all(true)`, `entry` = the data.json name).
  - Scene > Open file... / drop on the view → `open_files(files)` in script.js → `Resources.load_files(files)`. Paths inside the model are matched to the picked files by relative path, then by name. OBJ textures come from the `.mtl` `map_Kd`; a lone picked image goes on meshes without a texture. `.usdc`/`.usdz` (and binary `.usd`) give a clear error and keep the current scene.

Pending:
- **More inkeeper clips.** The inkeeper entry in `apps/viewer/resources/data.json` has `idle` [5, 30], `run` [35, 50] and `attack` [55, 70], in the file's frame numbers. The user will provide the rest of the ranges later. `"default"` still covers the whole animation (about 463 frames at 24 fps).
- **`.usdc` / `.usdz` support**, postponed. A usdc reader should produce the same prim tree as `USDA.parse`, so the extraction code can be reused.
- **Possible improvement**, not requested yet: a 3-layer blend so that interrupting a crossfade doesn't pop.
