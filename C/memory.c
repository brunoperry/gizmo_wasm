#include <stdint.h>
#include "memory.h"

#define WASM_PAGE 65536u

extern unsigned char __heap_base;
static uintptr_t heap_ptr = 0;

void *gz_alloc(size_t size)
{
    if (!heap_ptr)
        heap_ptr = (uintptr_t)&__heap_base;

    uintptr_t p = (heap_ptr + 15) & ~(uintptr_t)15;
    uintptr_t end = p + size;
    if (end < p)
        return NULL;

    uintptr_t capacity = (uintptr_t)__builtin_wasm_memory_size(0) * WASM_PAGE;
    if (end > capacity)
    {
        size_t pages = (end - capacity + WASM_PAGE - 1) / WASM_PAGE;
        if (__builtin_wasm_memory_grow(0, pages) == (size_t)-1)
            return NULL;
    }
    heap_ptr = end;
    // Fresh wasm pages are zeroed and memory is never reused, so no memset needed.
    return (void *)p;
}
