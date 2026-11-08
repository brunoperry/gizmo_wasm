#include <stdint.h>
#include "memory.h"

#define WASM_PAGE 65536u

extern unsigned char __heap_base;
static uintptr_t heap_ptr = 0;
// Everything below this was handed out at some point; above it, memory is
// still as fresh pages come (zeroed).
static uintptr_t high_water = 0;

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
    // Fresh wasm pages are zeroed: only memory reused after gz_release needs it.
    if (p < high_water)
        __builtin_memset((void *)p, 0, (end < high_water ? end : high_water) - p);
    if (end > high_water)
        high_water = end;
    return (void *)p;
}

uintptr_t gz_mark(void)
{
    if (!heap_ptr)
        heap_ptr = (uintptr_t)&__heap_base;
    return heap_ptr;
}

void gz_release(uintptr_t mark)
{
    if (mark && mark <= heap_ptr)
        heap_ptr = mark;
}
