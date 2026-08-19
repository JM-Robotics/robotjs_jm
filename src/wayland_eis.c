#include "wayland_eis.h"

#if defined(__linux__)

#include <dbus/dbus.h>
#include <libei.h>
#include <poll.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static DBusConnection *sessionBus = NULL;
static struct ei *eisContext = NULL;
static struct ei_device *absoluteDevice = NULL;
static bool absoluteResumed = false;
static bool absoluteEmulating = false;
static int remoteDesktopCookie = -1;
static uint32_t emulationSequence = 1;

static void closeWaylandMouse(void)
{
	if (absoluteDevice != NULL) {
		if (absoluteEmulating) ei_device_stop_emulating(absoluteDevice);
		ei_device_unref(absoluteDevice);
		absoluteDevice = NULL;
	}
	if (eisContext != NULL) {
		ei_unref(eisContext);
		eisContext = NULL;
	}
	if (sessionBus != NULL && remoteDesktopCookie >= 0) {
		DBusMessage *message = dbus_message_new_method_call(
			"org.kde.KWin",
			"/org/kde/KWin/EIS/RemoteDesktop",
			"org.kde.KWin.EIS.RemoteDesktop",
			"disconnect");
		if (message != NULL) {
			dbus_int32_t cookie = remoteDesktopCookie;
			dbus_message_append_args(message, DBUS_TYPE_INT32, &cookie, DBUS_TYPE_INVALID);
			dbus_connection_send(sessionBus, message, NULL);
			dbus_connection_flush(sessionBus);
			dbus_message_unref(message);
		}
	}
	remoteDesktopCookie = -1;
	absoluteResumed = false;
	absoluteEmulating = false;
}

static bool connectKWinEis(int *fdOut)
{
	DBusError error;
	DBusMessage *message;
	DBusMessage *reply;
	dbus_int32_t capabilities = 2;
	dbus_int32_t cookie = -1;
	int receivedFd = -1;

	dbus_error_init(&error);
	sessionBus = dbus_bus_get(DBUS_BUS_SESSION, &error);
	if (sessionBus == NULL) {
		dbus_error_free(&error);
		return false;
	}

	message = dbus_message_new_method_call(
		"org.kde.KWin",
		"/org/kde/KWin/EIS/RemoteDesktop",
		"org.kde.KWin.EIS.RemoteDesktop",
		"connectToEIS");
	if (message == NULL) return false;
	dbus_message_append_args(message, DBUS_TYPE_INT32, &capabilities, DBUS_TYPE_INVALID);
	reply = dbus_connection_send_with_reply_and_block(sessionBus, message, 5000, &error);
	dbus_message_unref(message);
	if (reply == NULL) {
		dbus_error_free(&error);
		return false;
	}
	if (!dbus_message_get_args(reply, &error,
		DBUS_TYPE_UNIX_FD, &receivedFd,
		DBUS_TYPE_INT32, &cookie,
		DBUS_TYPE_INVALID)) {
		dbus_message_unref(reply);
		dbus_error_free(&error);
		return false;
	}
	*fdOut = dup(receivedFd);
	remoteDesktopCookie = cookie;
	dbus_message_unref(reply);
	return *fdOut >= 0;
}

static void handleEisEvents(void)
{
	struct ei_event *event;
	ei_dispatch(eisContext);
	while ((event = ei_get_event(eisContext)) != NULL) {
		enum ei_event_type type = ei_event_get_type(event);
		if (type == EI_EVENT_SEAT_ADDED) {
			ei_seat_bind_capabilities(
				ei_event_get_seat(event),
				EI_DEVICE_CAP_POINTER,
				EI_DEVICE_CAP_POINTER_ABSOLUTE,
				EI_DEVICE_CAP_BUTTON,
				EI_DEVICE_CAP_SCROLL,
				NULL);
		} else if (type == EI_EVENT_DEVICE_ADDED) {
			struct ei_device *device = ei_event_get_device(event);
			if (absoluteDevice == NULL
				&& ei_device_has_capability(device, EI_DEVICE_CAP_POINTER_ABSOLUTE)
				&& ei_device_has_capability(device, EI_DEVICE_CAP_BUTTON)) {
				absoluteDevice = ei_device_ref(device);
			}
		} else if (type == EI_EVENT_DEVICE_RESUMED) {
			if (ei_event_get_device(event) == absoluteDevice) {
				absoluteResumed = true;
			}
		} else if (type == EI_EVENT_DEVICE_PAUSED) {
			if (ei_event_get_device(event) == absoluteDevice) {
				absoluteResumed = false;
				absoluteEmulating = false;
			}
		}
		ei_event_unref(event);
	}
}

bool waylandSessionActive(void)
{
	const char *sessionType = getenv("XDG_SESSION_TYPE");
	const char *waylandDisplay = getenv("WAYLAND_DISPLAY");
	return (sessionType != NULL && strcmp(sessionType, "wayland") == 0)
		|| (waylandDisplay != NULL && waylandDisplay[0] != '\0');
}

bool waylandMouseInit(void)
{
	int backendFd = -1;
	int attempts;

	if (absoluteDevice != NULL && absoluteResumed) return true;
	if (eisContext == NULL) {
		if (!connectKWinEis(&backendFd)) return false;
		eisContext = ei_new_sender(NULL);
		if (eisContext == NULL) return false;
		ei_configure_name(eisContext, "robotjs_jm");
		if (ei_setup_backend_fd(eisContext, backendFd) < 0) {
			closeWaylandMouse();
			return false;
		}
		atexit(closeWaylandMouse);
	}

	for (attempts = 0; attempts < 50 && (!absoluteDevice || !absoluteResumed); attempts++) {
		struct pollfd descriptor;
		descriptor.fd = ei_get_fd(eisContext);
		descriptor.events = POLLIN;
		descriptor.revents = 0;
		poll(&descriptor, 1, 100);
		handleEisEvents();
	}
	if (!absoluteDevice || !absoluteResumed) return false;
	if (!absoluteEmulating) {
		ei_device_start_emulating(absoluteDevice, emulationSequence++);
		ei_dispatch(eisContext);
		absoluteEmulating = true;
	}
	return true;
}

bool waylandMouseMoveAbsolute(int x, int y)
{
	if (!waylandMouseInit()) return false;
	if (ei_device_get_region_at(absoluteDevice, x, y) == NULL) return false;
	ei_device_pointer_motion_absolute(absoluteDevice, x, y);
	ei_device_frame(absoluteDevice, ei_now(eisContext));
	ei_dispatch(eisContext);
	return true;
}

bool waylandMouseButton(unsigned int buttonCode, bool down)
{
	if (!waylandMouseInit()) return false;
	ei_device_button_button(absoluteDevice, buttonCode, down);
	ei_device_frame(absoluteDevice, ei_now(eisContext));
	ei_dispatch(eisContext);
	return true;
}

bool waylandMouseScroll(int x, int y)
{
	if (!waylandMouseInit()) return false;
	ei_device_scroll_discrete(absoluteDevice, x, y);
	ei_device_frame(absoluteDevice, ei_now(eisContext));
	ei_dispatch(eisContext);
	return true;
}

#else

bool waylandSessionActive(void) { return false; }
bool waylandMouseInit(void) { return false; }
bool waylandMouseMoveAbsolute(int x, int y) { (void)x; (void)y; return false; }
bool waylandMouseButton(unsigned int buttonCode, bool down) { (void)buttonCode; (void)down; return false; }
bool waylandMouseScroll(int x, int y) { (void)x; (void)y; return false; }

#endif
