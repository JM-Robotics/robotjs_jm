const { createBrowserInputAdapter, mapBrowserKeyEvent } = require('../browser-input-adapter');

describe('browser input adapter', () => {
    it('maps browser modifiers, navigation, punctuation, numpad, and international input', () => {
        expect(mapBrowserKeyEvent({ code: 'ShiftRight', key: 'Shift', direction: 'keydown' }))
            .toEqual({ action: 'keyToggle', key: 'right_shift', direction: 'down' });
        expect(mapBrowserKeyEvent({ code: 'Enter', key: 'Enter', direction: 'keyup' }))
            .toEqual({ action: 'keyToggle', key: 'enter', direction: 'up' });
        expect(mapBrowserKeyEvent({ code: 'ArrowLeft', key: 'ArrowLeft', direction: 'keydown' }))
            .toEqual({ action: 'keyToggle', key: 'left', direction: 'down' });
        expect(mapBrowserKeyEvent({ code: 'Slash', key: '?', direction: 'keydown' }))
            .toEqual({ action: 'unicodeTap', codePoint: '?'.codePointAt(0), direction: 'down' });
        expect(mapBrowserKeyEvent({ code: 'Numpad7', key: '7', direction: 'keydown' }))
            .toEqual({ action: 'keyToggle', key: 'numpad_7', direction: 'down' });
        expect(mapBrowserKeyEvent({ code: 'IntlYen', key: 'ø', direction: 'keydown' }))
            .toEqual({ action: 'unicodeTap', codePoint: 'ø'.codePointAt(0), direction: 'down' });
        expect(mapBrowserKeyEvent({ code: 'IntlYen', key: 'ø', direction: 'keyup' }))
            .toEqual({ action: 'none', direction: 'up' });

        for (const [code, key, expected] of [
            ['Backspace', 'Backspace', 'backspace'], ['Escape', 'Escape', 'escape'], ['Space', ' ', 'space'],
            ['ControlLeft', 'Control', 'left_control'], ['AltLeft', 'Alt', 'alt'], ['MetaLeft', 'Meta', 'command'],
            ['NumpadAdd', '+', 'numpad_+'],
        ]) {
            expect(mapBrowserKeyEvent({ code, key, direction: 'keydown' }))
                .toEqual({ action: 'keyToggle', key: expected, direction: 'down' });
            expect(mapBrowserKeyEvent({ code, key, direction: 'keyup' }))
                .toEqual({ action: 'keyToggle', key: expected, direction: 'up' });
        }

        expect(mapBrowserKeyEvent({ code: 'BracketLeft', key: 'å', direction: 'keydown' }))
            .toEqual({ action: 'unicodeTap', codePoint: 'å'.codePointAt(0), direction: 'down' });
        expect(mapBrowserKeyEvent({ code: 'KeyA', key: 'q', direction: 'keydown' }))
            .toEqual({ action: 'unicodeTap', codePoint: 'q'.codePointAt(0), direction: 'down' });
        expect(mapBrowserKeyEvent(
            { code: 'KeyC', key: 'c', direction: 'keydown' },
            new Set(['left_control']),
        )).toEqual({ action: 'keyToggle', key: 'c', direction: 'down' });
    });

    it('tracks and releases held keys and buttons', () => {
        const calls = [];
        const adapter = createBrowserInputAdapter({
            keyToggle: (key, direction) => calls.push(['key', key, direction]),
            mouseToggle: (direction, button) => calls.push(['mouse', button, direction]),
            unicodeTap: (codePoint) => calls.push(['unicode', codePoint]),
        });
        adapter.keyEvent({ code: 'ControlLeft', key: 'Control', direction: 'keydown' });
        adapter.keyEvent({ code: 'KeyA', key: 'a', direction: 'keydown' });
        adapter.mouseButton('down', 'left');
        adapter.releaseAll();
        expect(calls).toEqual([
            ['key', 'left_control', 'down'], ['key', 'a', 'down'], ['mouse', 'left', 'down'],
            ['key', 'a', 'up'], ['key', 'left_control', 'up'], ['mouse', 'left', 'up'],
        ]);
        expect(adapter.getState()).toEqual({ heldKeyCount: 0, heldButtonCount: 0 });
    });
});
