#include "transform.h"

transform_t transform_build(unsigned int *obj_buffer)
{
    transform_t transform;

    obj_buffer[3] = (unsigned int)malloc(3 * sizeof(float));
    obj_buffer[4] = (unsigned int)malloc(3 * sizeof(float));
    obj_buffer[5] = (unsigned int)malloc(3 * sizeof(float));

    transform.position = (float *)obj_buffer[3];
    transform.rotation = (float *)obj_buffer[4];
    transform.scale = (float *)obj_buffer[5];

    return transform;
}