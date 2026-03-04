#include "keycode.h"

#if defined(IS_MACOSX)

#include <CoreFoundation/CoreFoundation.h>
#include <Carbon/Carbon.h> /* For kVK_ constants, and TIS functions. */

/* Returns string representation of key, if it is printable.
 * Ownership follows the Create Rule; that is, it is the caller's
 * responsibility to release the returned object. */
CFStringRef createStringForKey(CGKeyCode keyCode);

#elif defined(USE_X11)

/*
 * Structs to store key mappings not handled by XStringToKeysym() on some
 * Linux systems.
 */

struct XSpecialCharacterMapping {
	char name;
	MMKeyCode code;
};

struct XSpecialCharacterMapping XSpecialCharacterTable[] = {
	 {'~', XK_asciitilde},
	{'_', XK_underscore},
	{'[', XK_bracketleft},
	{']', XK_bracketright},
	{'!', XK_exclam},
	{'\'', XK_quotedbl},
	{'#', XK_numbersign},
	{'$', XK_dollar},
	{'%', XK_percent},
	{'&', XK_ampersand},
	{'\'', XK_quoteright},
	{'*', XK_asterisk},
	{'+', XK_plus},
	{',', XK_comma},
	{'-', XK_minus},
	{'.', XK_period},
	{'?', XK_question},
	{'<', XK_less},
	{'>', XK_greater},
	{'=', XK_equal},
	{'@', XK_at},
	{':', XK_colon},
	{';', XK_semicolon},
	{'\\', XK_backslash},
	{'`', XK_grave},
	{'{', XK_braceleft},
	{'}', XK_braceright},
	{'|', XK_bar},
	{'^', XK_asciicircum},
	{'(', XK_parenleft},
	{')', XK_parenright},
	{' ', XK_space},
	{'/', XK_slash},
	{'\t', XK_Tab},
	{'\n', XK_Return},
	{'\xe6', 0x00e6}, /* æ */
	{'\xf8', 0x00f8}, /* ø */
	{'\xe5', 0x00e5}, /* å */
	{'\xc6', 0x00c6}, /* Æ */
	{'\xd8', 0x00d8}, /* Ø */
	{'\xc5', 0x00c5}  /* Å */
};

#endif

MMKeyCode keyCodeForChar(const char c)
{
#if defined(IS_MACOSX)
   /* OS X does not appear to have a built-in function for this, so instead we
	* have to write our own. */
   static CFMutableDictionaryRef charToCodeDict = NULL;
   size_t code;
   UniChar character = c;
   CFStringRef charStr = NULL;

   /* Generate table of keycodes and characters. */
   if (charToCodeDict == NULL) {
	   size_t i;
	   charToCodeDict = CFDictionaryCreateMutable(kCFAllocatorDefault,
												  128,
												  &kCFCopyStringDictionaryKeyCallBacks,
												  NULL);
	   if (charToCodeDict == NULL) return UINT16_MAX;

	   /* Loop through every keycode (0 - 127) to find its current mapping. */
	   for (i = 0; i < 128; ++i) {
		   CFStringRef string = createStringForKey((CGKeyCode)i);
		   if (string != NULL) {
			   CFDictionaryAddValue(charToCodeDict, string, (const void *)i);
			   CFRelease(string);
		   }
	   }
   }

   charStr = CFStringCreateWithCharacters(kCFAllocatorDefault, &character, 1);

   if (!CFDictionaryGetValueIfPresent(charToCodeDict, charStr,
									  (const void **)&code)) {
	   // Fallback for æ, ø, å and uppercase
	   switch ((unsigned char)c) {
		   case 0xe6: code = 0x2b; break; /* æ */
		   case 0xf8: code = 0x2c; break; /* ø */
		   case 0xe5: code = 0x21; break; /* å */
		   case 0xc6: code = 0x2b; break; /* Æ */
		   case 0xd8: code = 0x2c; break; /* Ø */
		   case 0xc5: code = 0x21; break; /* Å */
		   default: code = UINT16_MAX; /* Error */
	   }
   }

   CFRelease(charStr);
   return (MMKeyCode)code;
#elif defined(IS_WINDOWS)
   SHORT vk = VkKeyScan(c);
   if (vk == -1) {
	   // Fallback for æ, ø, å and uppercase
	   switch ((unsigned char)c) {
		   case 0xe6: return 0x00e6; /* æ */
		   case 0xf8: return 0x00f8; /* ø */
		   case 0xe5: return 0x00e5; /* å */
		   case 0xc6: return 0x00c6; /* Æ */
		   case 0xd8: return 0x00d8; /* Ø */
		   case 0xc5: return 0x00c5; /* Å */
		   default: return -1;
	   }
   }
   return vk;
#elif defined(USE_X11)
	MMKeyCode code;

	char buf[2];
	buf[0] = c;
	buf[1] = '\0';

	code = XStringToKeysym(buf);
	if (code == NoSymbol) {
		/* Some special keys are apparently not handled properly by
		 * XStringToKeysym() on some systems, so search for them instead in our
		 * mapping table. */
		size_t i;
		const size_t specialCharacterCount =
			sizeof(XSpecialCharacterTable) / sizeof(XSpecialCharacterTable[0]);
		for (i = 0; i < specialCharacterCount; ++i) {
			if (c == XSpecialCharacterTable[i].name) {
				code = XSpecialCharacterTable[i].code;
				break;
			}
		}
	}

	return code;
#endif
}

#if defined(IS_MACOSX)

CFStringRef createStringForKey(CGKeyCode keyCode)
{
	TISInputSourceRef currentKeyboard = TISCopyCurrentASCIICapableKeyboardInputSource();
	CFDataRef layoutData =
		TISGetInputSourceProperty(currentKeyboard,
		                          kTISPropertyUnicodeKeyLayoutData);
	const UCKeyboardLayout *keyboardLayout =
		(const UCKeyboardLayout *)CFDataGetBytePtr(layoutData);

	UInt32 keysDown = 0;
	UniChar chars[4];
	UniCharCount realLength;

	UCKeyTranslate(keyboardLayout,
	               keyCode,
	               kUCKeyActionDisplay,
	               0,
	               LMGetKbdType(),
	               kUCKeyTranslateNoDeadKeysBit,
	               &keysDown,
	               sizeof(chars) / sizeof(chars[0]),
	               &realLength,
	               chars);
	CFRelease(currentKeyboard);

	return CFStringCreateWithCharacters(kCFAllocatorDefault, chars, 1);
}

#endif
