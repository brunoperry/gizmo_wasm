CC=clang

clean:
	rm -f web/src/gizmo.wasm

build:
	$(CC) \
	--target=wasm32-unknown-wasi \
	--sysroot /Users/brunoperry/libs/wasi-libc \
	-nostartfiles \
	-mbulk-memory \
	-Wall \
	-g \
	-O3 -flto \
	-Wl,--no-check-features \
	-Wl,--export-dynamic \
	-Wl,--no-entry \
	-Wl,--lto-O3 \
	-o web/src/gizmo.wasm \
	C/*.c

# build:
# 	$(CC) \
# 		--target=wasm32-unknown-wasi \
# 		--sysroot /Users/brunoperry/libs/wasi-libc \
# 		-nostartfiles \
# 		-mbulk-memory \
# 		-Wall \
# 		-g \
# 		-O3 -flto \
# 		-nostdlib \
# 		-Wl,--no-check-features \
# 		-Wl,--export-dynamic \
# 		-Wl,--no-entry \
# 		-Wl,--lto-O3 \
# 		-o web/src/gizmo.wasm C/*.c