#include "light3d.h"

inline light_t *light_build(light_t *light_to_build)
{
    light_t *light = (light_t *)malloc(sizeof(light_t));

    light->direction = light_to_build->direction;
    light->color = 0xff0000ff;

    return light;
}

inline int light_apply_intensity(int original_color, float percentage_factor)
{
    if (percentage_factor < 0.3)
        percentage_factor = 0.3;
    else if (percentage_factor > 1)
        percentage_factor = 1;

    int color = (original_color & 0xFF000000) |
                ((int)((original_color & 0x00FF0000) * percentage_factor) & 0x00FF0000) |
                ((int)((original_color & 0x0000FF00) * percentage_factor) & 0x0000FF00) |
                ((int)((original_color & 0x000000FF) * percentage_factor) & 0x000000FF);

    return color;
}

inline int light_apply_ambient(light_t light, int color)
{
    int ambient = 1 * light.color;
    return (color & 0xFF000000) |
           ((int)((color & 0x00FF0000) * ambient) & 0x00FF0000) |
           ((int)((color & 0x0000FF00) * ambient) & 0x0000FF00) |
           ((int)((color & 0x000000FF) * ambient) & 0x000000FF);
}