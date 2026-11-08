#ifndef MEMORY_H
#define MEMORY_H

#include <stddef.h>

#include <stdint.h>

// Bump allocator on top of the wasm linear memory.
// Nothing is freed one by one: gz_release(mark) drops everything allocated
// after gz_mark() returned `mark` (used to unload a scene). Returned memory is
// 16-byte aligned and zero-filled. Returns NULL if the memory can't grow.
//
// NOTE: growing the memory detaches every JS view of the old ArrayBuffer;
// the JS side must re-create its typed arrays (see Display.js).
void *gz_alloc(size_t size);

uintptr_t gz_mark(void);
void gz_release(uintptr_t mark);

// Whether `p` was allocated after `mark` (so gz_release(mark) frees it).
static inline int gz_after(const void *p, uintptr_t mark)
{
    return p && (uintptr_t)p >= mark;
}

#endif
