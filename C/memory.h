#ifndef MEMORY_H
#define MEMORY_H

#include <stddef.h>

// Bump allocator on top of the wasm linear memory.
// Everything the engine allocates lives for the whole session, so nothing is
// ever freed. Returned memory is 16-byte aligned and zero-filled.
// Returns NULL if the memory can't grow.
//
// NOTE: growing the memory detaches every JS view of the old ArrayBuffer;
// the JS side must re-create its typed arrays (see Display.js).
void *gz_alloc(size_t size);

#endif
