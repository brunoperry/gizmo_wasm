# Path to the WASI SDK (https://github.com/WebAssembly/wasi-sdk/releases).
# Override with: make build WASI_SDK=/path/to/wasi-sdk
WASI_SDK ?= $(HOME)/libs/wasi-sdk-25.0-x86_64-macos

CC = $(WASI_SDK)/bin/clang
OUT = web/src/gizmo.wasm
SRC = $(wildcard C/*.c)

CFLAGS = \
	--target=wasm32-wasip1 \
	--sysroot $(WASI_SDK)/share/wasi-sysroot \
	-std=c11 -Wall -Wextra \
	-O3 \
	-ffast-math \
	-msimd128 -mbulk-memory -mnontrapping-fptoint -msign-ext

LDFLAGS = \
	-nostartfiles \
	-Wl,--no-entry \
	-Wl,--strip-debug

comma := ,

.PHONY: build debug clean

build: $(OUT)

$(OUT): $(SRC) $(wildcard C/*.h) makefile
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SRC)

# Unoptimized build with debug info (DWARF) for the browser devtools.
debug: CFLAGS := $(filter-out -O3 -ffast-math,$(CFLAGS)) -O0 -g
debug: LDFLAGS := $(filter-out -Wl$(comma)--strip-debug,$(LDFLAGS))
debug:
	$(CC) $(CFLAGS) $(LDFLAGS) -o $(OUT) $(SRC)

clean:
	rm -f $(OUT)
