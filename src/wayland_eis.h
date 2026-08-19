#pragma once
#ifndef WAYLAND_EIS_H
#define WAYLAND_EIS_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C"
{
#endif

bool waylandSessionActive(void);
bool waylandMouseInit(void);
bool waylandMouseMoveAbsolute(int x, int y);
bool waylandMouseButton(unsigned int buttonCode, bool down);
bool waylandMouseScroll(int x, int y);

#ifdef __cplusplus
}
#endif

#endif
