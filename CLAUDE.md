# Gizmo WASM

A 3D software renderer. The C code in `C/` compiles to `web/src/gizmo.wasm`, and the JS in `web/src/` drives it. There are no dependencies: serve `web/` on localhost and open `index.html`.

## Working with the user
- Reply in European Portuguese.
- The user makes their own commits. Never commit or push unless asked.
- Performance is a top priority. Measure before and after when changing hot paths (raster, renderer, shadows, skinning).
- Leave `web/src/TestScene.js` alone unless asked; it's the user's playground scene.

## Build
- `make build`: wasi-sdk 25, target `wasm32-wasip1`, `-O3 -ffast-math -msimd128`.
  - The SDK path defaults to `$(HOME)/libs/wasi-sdk-25.0-x86_64-macos`. Override it with `make build WASI_SDK=/path`.
- `make debug`: -O0 build with DWARF debug info.
- `gizmo.wasm` is committed (and also listed in .gitignore). Rebuild it after any C change.
- Under `-ffast-math`:
  - don't use `INFINITY` (use `1e30f`);
  - don't rely on NaN checks;
  - clamp absurd inputs instead.
- Memory comes from a bump allocator, `gz_alloc` (C/memory.c). Nothing is freed.
- When the wasm memory grows, JS views onto `WASM.mem` go stale. Create typed-array views on demand; don't keep them.

## Conventions (easy to get wrong)
- **World space** is right-handed. View space is mirrored, so in view space the outward face normal is `-cross(b-a, c-a)`. Counter-clockwise triangles face out.
- **Matrices** are row-major and multiply column vectors (`p' = M·p`). USD matrices are transposed on import (`from_usd_matrix` in USDA.js).
- **Display buffer:** each uint32 pixel is `A<<24 | B<<16 | G<<8 | R`.
- **Meshes** are triangle soup: every triangle corner has its own vertex, uv and normal. `Object3D.from_faces` builds it from (point, uv, normal) index triplets.
- **Normals:** when a file has no normals, they are computed at load time (`web/src/Normals.js`). Edges sharper than the crease angle stay hard (60° by default; a `"crease_angle"` in a data.json entry overrides it). Points at the same position are welded.
- **Render settings** are 4 ints written by JS: render mode, lighting mode (TRIANGLE / VERTEX / PIXEL), show light gizmos, shadows.
- **Lights:** up to 8. They live in a float block: a 4-float header (count, ambient rgb), then 16 floats per light (see `C/light3d.h`). Lighting is evaluated in view space.
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
- **The `Engine` is locked** until "next" is clicked. Headless tests must click `#next` after each change before taking a screenshot.

## USD loader (`web/src/USDA.js`)
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
- smoothed camera;
- skeletal animation with clips and crossfades;
- normals computed at load time.

Pending:
- The **inkeeper clip frame ranges**: the user will provide them. They go in `web/resources/data.json` under the inkeeper entry: `"clips": { "name": [start, end] }`, using the file's frame numbers. Until then everything plays as the `"default"` clip (the whole animation, about 463 frames at 24 fps).
- **`.usdc` / `.usdz` support**, planned for later. A usdc reader should produce the same prim tree as `USDA.parse`, so the extraction code can be reused.
- **Possible improvements**, not requested yet:
  - resize `inkeeper_map.jpeg` (1280², not a power of two, so it takes the slower raster path) to 1024²;
  - a 3-layer blend so that interrupting a crossfade doesn't pop.
