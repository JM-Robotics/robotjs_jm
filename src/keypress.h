#pragma once
#ifndef KEYPRESS_H
#define KEYPRESS_H

#include "os.h"
#include "keycode.h"

#if defined(_MSC_VER)
	#include "ms_stdbool.h"
#else
	#include <stdbool.h>
#endif
#ifdef __cplusplus
extern "C" 
{
#endif


#if defined(IS_MACOSX)
typedef enum _MMKeyFlags {
	MOD_NONE = 0,
	MOD_META = kCGEventFlagMaskCommand,
	MOD_ALT = kCGEventFlagMaskAlternate,
	MOD_RIGHT_ALT = (1 << 30), /* Custom bit, not used by system */
	MOD_CONTROL = kCGEventFlagMaskControl,
	MOD_SHIFT = kCGEventFlagMaskShift
} MMKeyFlags;
#elif defined(USE_X11)
typedef enum _MMKeyFlags {
	MOD_NONE = 0,
	MOD_META = Mod4Mask,
	MOD_ALT = Mod1Mask,
	MOD_RIGHT_ALT = (1 << 30), /* Custom bit, not used by X11 */
	MOD_CONTROL = ControlMask,
	MOD_SHIFT = ShiftMask
} MMKeyFlags;
#elif defined(IS_WINDOWS)
typedef enum _MMKeyFlags {
	MOD_NONE = 0,
	MOD_META = MOD_WIN,
	MOD_ALT = 0x0001,
	MOD_RIGHT_ALT = 0x0002, /* Custom bit, not used by Win32 */
	MOD_CONTROL = 0x0004,
	MOD_SHIFT = 0x0008
} MMKeyFlags;
#endif

#if defined(IS_WINDOWS)
/* Send win32 key event for given key. */
void win32KeyEvent(int key, MMKeyFlags flags);
#endif

/* Toggles the given key down or up. */
void toggleKeyCode(MMKeyCode code, const bool down, MMKeyFlags flags);

/* Toggles the key down and then up. */
void tapKeyCode(MMKeyCode code, MMKeyFlags flags);

/* Toggles the key corresponding to the given UTF character up or down. */
void toggleKey(char c, const bool down, MMKeyFlags flags);
void tapKey(char c, MMKeyFlags flags);

/* Sends a Unicode character without modifiers. */
void unicodeTap(const unsigned value);

/* Macro to convert WPM to CPM integers.
 * (the average English word length is 5.1 characters.) */
#define WPM_TO_CPM(WPM) (unsigned)(5.1 * WPM)

/* Sends a UTF-8 string without modifiers and with partially random delays between each letter.
 * Note that deadbeef_srand() must be called before this function if you actually want
 * randomness. */
void typeStringDelayed(const char *str, const unsigned cpm);

#ifdef __cplusplus
}
#endif

#endif /* KEYPRESS_H */
