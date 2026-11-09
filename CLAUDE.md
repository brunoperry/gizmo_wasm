# Gizmo WASM

A 3D software renderer (the Gizmo engine) plus the apps built on it. There are no dependencies: serve the repo root on localhost and open `/apps/viewer/`.

## Layout
- `engine/C/`: the renderer in C, compiled to `engine/js/gizmo.wasm`.
- `engine/js/`: the engine's JS side. `index.js` is its public API; the other modules are internal.
- `apps/viewer/`: the model viewer (menus, HUD, `ModelScene`, `TestScene`, its `resources/` with `data.json`).
- `apps/marginal/`: the racing game "Marginal" (see below), at `/apps/marginal/`.
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
  - `scene.sky = color` makes the clear color opaque (null = the default translucent one).
    - `scene.fog = { near, far }` fades into the sky by view depth. Set `camera.z_far = far` to match.
    - Both are reset by `load_scene` (C `set_environment`).
  - Objects whose bounds are outside the frustum are skipped (`object_visible` in renderer.c).
    - Big worlds should be split into tiles (separate meshes) so this helps.
  - The grid is off by default in the engine; the viewer turns it on.
  - For big worlds with shadows:
    - `new Light3D({ shadow_distance })` (directional only): 0 = the map holds the whole scene; > 0 = the map follows the camera and holds the view up to that depth.
    - `object.cast_shadows = false` leaves an object out of the shadow maps (it still receives shadows). Use it for the ground.
    - At most 1024 objects (`MAX_OBJECTS` in engine/C/object.h; only arrays of pointers, cheap to raise).
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
  - each map has a cover grid (blocks of 4×4 texels that hold any caster) and its summed-area table (`cover_sum`): `shadow_span_lit` tells with 4 reads that a span or triangle is in full sun, so it skips the lookups.
- **Sun path** (renderer.c, `LIGHTING_SUN` in raster.c): PIXEL lighting with only directional lights doesn't evaluate the lights per pixel. Per triangle it works out `base` (ambient + the other lights) and the pixels only do `base + sun · lambert · shadow`; a flat triangle in full sun is drawn as TRIANGLE lighting. The result is the same as the general path.
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

## Marginal (`apps/marginal/`)
- Free driving on the Avenida Marginal (EN6), Algés → Paço de Arcos (~7 km; Cruz Quebrada → Paço de Arcos was added on 2026-11-09). This is a proof of concept.
  - The user picked: a mixed style (flat palette colors, textured road), free driving first, and chase + hood cameras (C).
- The world is generated from OpenStreetMap, never edited by hand:
  - `tools/fetch_osm.sh` downloads the area into `tools/osm/` (gitignored), in parts: the OSM API only gives areas under 50000 nodes. build_world reads every `.osm` there as one (`read_osm_files`).
  - To add a stretch: add a `get` line to fetch_osm.sh and widen `AREA` in build_world (both ends are walls).
  - `node apps/marginal/tools/build_world.mjs` writes:
    - `resources/world/marginal.usda`: 200 m tiles, up to 3 meshes per tile: `ground_<tx>_<tz>` (palette: land, water, streets, rails), `road_<tx>_<tz>` (the EN6 lanes, `road` texture), `solid_<tx>_<tz>` (palette: buildings, platforms, seawall, piers), plus `sea`;
    - `resources/world/map.json`: spawn, drivable road segments, collision walls, the EN6 route, `terrain` (the height grid, in centimetres);
    - `resources/images/palette.png`, `road.png` (from `tools/textures.mjs`).
  - `node apps/marginal/tools/build_car.mjs` writes the placeholder car (`resources/meshes/car.usda`).
  - World axes: x = east, z = south, 1 unit = 1 m, origin at 38.699, -9.241 (`tools/osm.mjs`).
  - Flat colors are UVs pointing at one texel of `palette.png` (`palette_uv`), so a tile needs one texture.
  - Relief (`tools/terrain.mjs`):
    - Heights come from SRTM (1 arc-second). `tools/fetch_dem.sh` downloads the tile into `tools/dem/` (gitignored); build_world needs it.
    - The ground is a 40 m grid snapped to the tiles, each cell split in two triangles by the diagonal from its north-west corner. The SRTM data over the Tagus is noise, so everything outside the OSM land polygons is set to 2 m (`FLOOR`).
    - The EN6 is levelled: one smoothed height profile along the longest carriageway; grid nodes within 65 m of any carriageway take it, blending back to the relief by 150 m. Result: slope ≤ 5.9% along the road, ≤ 1.3% across it.
    - Everything flat (land, water, streets, rails, the EN6 lanes) is cut along the grid (`Terrain.drape`) and laid on the ground's triangles, with the ground's normal and a small lift so layers don't z-fight (`Y` in build_world). Buildings are blocks from below their lowest corner to their height above the highest.
    - Now 421 meshes and ~78k triangles (5.8 MB usda; 205 meshes and 41k triangles for Algés → Cruz Quebrada).
  - OSM data quirks the builder handles:
    - The EN6 carriageways are joined by `chain_roads` (osm.mjs): the straightest way at forks, never a sharp turn. The plain `chain_ways` U-turned in Algés, where the two directions meet.
    - Closed coastlines inside the area are islands (there's one off Paço de Arcos). Treating one as an open run turned the whole sea into land.
    - Water edges are checked against the roads in 3 m pieces to leave a gap where a road crosses. Whole edges left an invisible wall across the EN6 on the Jamor bridge.
    - Buildings that reach into the EN6's lanes are moved out of them (3 are, among them Algés station) or dropped if more than 4 m in.
  - The credit "© OpenStreetMap contributors" must stay visible in the game (ODbL).
- Game code (`src/`):
  - `WorldMap`: grid lookups on map.json for `on_road` and `collide`; `height(x, z)` is exactly the ground mesh.
  - `Car`: arcade physics with a 1/120 s fixed step, simulated seen from above (the user wants the feel of Midtown Madness).
    - Forward and sideways speed; grip absorbs the sideways part (handbrake / off-road / braking hard: less grip).
    - The car turns no faster than the tyres allow at its speed (`cornering` m/s²), so it runs wide when too fast. Slopes pull it (`ground_pitch`); `hold` keeps it parked on them.
    - Height and tilt come from the ground under the 4 wheels. The body ("body" mesh) sits on 3 springs (roll, pitch, heave) driven by the car's acceleration: it leans in turns, dives and squats, and gets a jolt in a crash. This is only for show. The 4 wheel meshes stay on the ground, spin and steer.
    - The tuning constants are the fields at the top of the class (`suspension_frequency`, `suspension_damping`, `roll_gain`, `pitch_gain`, `cornering`, `grip`, ...).
    - Car model axes: +z forward, +x the car's left. `Object3D.rotation` is built as Rx · Ry · Rz, so poses are composed as matrices and converted (`euler` in Car.js).
  - `DriveCamera`: chase camera (stays above the ground) and hood camera (follows the body's pitch).
  - `MarginalScene`: sky, fog to 380 m, the sun with `shadow_distance` 70. Only the `solid_*` meshes and the car cast shadows.
  - script.js turns on PIXEL lighting and shadows.
  - `globalThis.marginal = { engine, world }` is there for the devtools console.
- Controls: arrows / W A S D, Space = handbrake, C = camera, R = restart, P = pause.
- Measured at the start view (~3.5k tris drawn, on a busy machine): triangle lighting 1.5–1.7 ms per frame, pixel 1.7 ms, pixel + shadows 2.9–3.0 ms, and 2.9–3.4 ms while the shadow map is redrawn every frame (driving). Along the new stretch: 1.7–2.7 ms. Ready ~0.7 s after the page opens; wasm memory 10 MB.
  - Before the relief (2.3k tris drawn of 21k): triangle 1.2 ms, pixel + shadows 2.1 ms.
  - Before the sun path and the cover grid, pixel + shadows took 6.9–7.9 ms.
  - Culling saves ~15%; fog costs ~0.05 ms.
- Checks for a rebuilt world (scripts are not in the repo): sample `WorldMap.collide` / `on_road` / `height` across the lanes of both carriageways (no walls, slopes), and drive both ways with an autopilot calling `car.update(1/60)` in a loop with `InputController.Keys` set (~5 min of driving each way).
- Headless Chrome tests: a key the page doesn't `preventDefault` (letters, Enter) sent through CDP makes the page hidden, which pauses the game. Start with `marginal.engine.play()` and set `InputController.Keys[code]` for those keys.

## Status and pending work (as of 2026-11-09)
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
