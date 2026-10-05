'use strict';

const DIRECTIONS = Object.freeze({ keydown: 'down', keyup: 'up', down: 'down', up: 'up' });

const CODE_KEYS = Object.freeze({
    Backspace: 'backspace', Tab: 'tab', Enter: 'enter', NumpadEnter: 'enter', Escape: 'escape', Space: 'space',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Home: 'home', End: 'end',
    PageUp: 'pageup', PageDown: 'pagedown', Insert: 'insert', Delete: 'delete', CapsLock: 'capslock',
    NumLock: 'numpad_lock', PrintScreen: 'printscreen', ContextMenu: 'menu', ShiftLeft: 'shift',
    ShiftRight: 'right_shift', ControlLeft: 'left_control', ControlRight: 'right_control', AltLeft: 'alt',
    AltRight: 'right_alt', MetaLeft: 'command', MetaRight: 'command', Numpad0: 'numpad_0',
    Numpad1: 'numpad_1', Numpad2: 'numpad_2', Numpad3: 'numpad_3', Numpad4: 'numpad_4',
    Numpad5: 'numpad_5', Numpad6: 'numpad_6', Numpad7: 'numpad_7', Numpad8: 'numpad_8',
    Numpad9: 'numpad_9', NumpadAdd: 'numpad_+', NumpadSubtract: 'numpad_-', NumpadMultiply: 'numpad_*',
    NumpadDivide: 'numpad_/', NumpadDecimal: 'numpad_.', NumpadComma: 'numpad_.',
});

const PRINTABLE_CODE_KEYS = Object.freeze({
    Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6',
    Digit7: '7', Digit8: '8', Digit9: '9', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
    IntlBackslash: '\\', IntlRo: '\\',
});

const KEY_FALLBACKS = Object.freeze({
    Backspace: 'backspace', Tab: 'tab', Enter: 'enter', Return: 'enter', Escape: 'escape', Esc: 'escape',
    ' ': 'space', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Home: 'home',
    End: 'end', PageUp: 'pageup', PageDown: 'pagedown', Insert: 'insert', Delete: 'delete',
    CapsLock: 'capslock', NumLock: 'numpad_lock', Shift: 'shift', Control: 'control', Ctrl: 'control',
    Alt: 'alt', AltGraph: 'right_alt', Meta: 'command',
});

function inputError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeDirection(value) {
    const direction = DIRECTIONS[String(value || '').toLowerCase()];
    if (!direction) throw inputError('ROBOTJS_KEY_DIRECTION_INVALID', 'Keyboard input requires a keydown or keyup direction');
    return direction;
}

function mapBrowserKeyEvent(event = {}) {
    const direction = normalizeDirection(event.direction || event.type);
    const code = String(event.code || '');
    const key = String(event.key || '');
    if (CODE_KEYS[code]) return { action: 'keyToggle', key: CODE_KEYS[code], direction };
    if (/^F(?:[1-9]|1\d|2[0-4])$/.test(code)) return { action: 'keyToggle', key: code.toLowerCase(), direction };
    if (/^Key[A-Z]$/.test(code)) return { action: 'keyToggle', key: code.slice(3).toLowerCase(), direction };
    if (PRINTABLE_CODE_KEYS[code]) return { action: 'keyToggle', key: PRINTABLE_CODE_KEYS[code], direction };
    if (KEY_FALLBACKS[key]) return { action: 'keyToggle', key: KEY_FALLBACKS[key], direction };

    const characters = Array.from(key);
    if (characters.length === 1) {
        const codePoint = characters[0].codePointAt(0);
        if (codePoint >= 0x20 && codePoint <= 0x7e) {
            return { action: 'keyToggle', key: characters[0].toLowerCase(), direction };
        }
        return direction === 'down' ? { action: 'unicodeTap', codePoint, direction } : { action: 'none', direction };
    }
    throw inputError('ROBOTJS_BROWSER_KEY_UNSUPPORTED', `Unsupported browser keyboard code '${code || key || 'unknown'}'`);
}

class BrowserInputAdapter {
    constructor(robot) {
        if (!robot || typeof robot.keyToggle !== 'function' || typeof robot.mouseToggle !== 'function') {
            throw new TypeError('BrowserInputAdapter requires RobotJS keyToggle and mouseToggle');
        }
        this.robot = robot;
        this.heldKeys = new Set();
        this.heldButtons = new Set();
    }

    keyEvent(event = {}) {
        const command = mapBrowserKeyEvent(event);
        if (command.action === 'none') return command;
        if (command.action === 'unicodeTap') {
            if (typeof this.robot.unicodeTap !== 'function') {
                throw inputError('ROBOTJS_UNICODE_UNAVAILABLE', 'RobotJS unicodeTap is unavailable');
            }
            this.robot.unicodeTap(command.codePoint);
            return command;
        }
        this.robot.keyToggle(command.key, command.direction);
        if (command.direction === 'down') this.heldKeys.add(command.key);
        else this.heldKeys.delete(command.key);
        return command;
    }

    mouseButton(direction, button) {
        const normalizedDirection = String(direction || '').replace('mouse', '').toLowerCase();
        if (normalizedDirection !== 'down' && normalizedDirection !== 'up') {
            throw inputError('ROBOTJS_MOUSE_DIRECTION_INVALID', 'Mouse input requires a down or up direction');
        }
        const normalizedButton = String(button || '').toLowerCase();
        if (!['left', 'middle', 'right'].includes(normalizedButton)) {
            throw inputError('ROBOTJS_MOUSE_BUTTON_INVALID', 'Mouse input requires a supported button');
        }
        this.robot.mouseToggle(normalizedDirection, normalizedButton);
        if (normalizedDirection === 'down') this.heldButtons.add(normalizedButton);
        else this.heldButtons.delete(normalizedButton);
    }

    releaseAll() {
        const failures = [];
        for (const key of [...this.heldKeys].reverse()) {
            try { this.robot.keyToggle(key, 'up'); } catch (error) { failures.push(error); }
        }
        for (const button of this.heldButtons) {
            try { this.robot.mouseToggle('up', button); } catch (error) { failures.push(error); }
        }
        this.heldKeys.clear();
        this.heldButtons.clear();
        if (failures.length > 0) throw inputError('ROBOTJS_RELEASE_FAILED', 'One or more held inputs could not be released');
    }

    getState() {
        return { heldKeyCount: this.heldKeys.size, heldButtonCount: this.heldButtons.size };
    }
}

function createBrowserInputAdapter(robot) {
    return new BrowserInputAdapter(robot);
}

module.exports = { BrowserInputAdapter, createBrowserInputAdapter, mapBrowserKeyEvent };
