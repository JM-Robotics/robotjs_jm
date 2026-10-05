const { createBrowserInputAdapter } = require('../browser-input-adapter');
const { createRobotHelperCommandHandler } = require('../robot-helper-command-handler');

describe('RobotJS helper command acknowledgements', () => {
    it('acknowledges only after native execution and correlates failures', () => {
        const events = [];
        const robot = {
            keyToggle: (key, direction) => events.push(['native', key, direction]), mouseToggle: () => {},
            moveMouse: () => {}, scrollMouse: () => {}, unicodeTap: () => {},
        };
        const handle = createRobotHelperCommandHandler({
            robot, inputAdapter: createBrowserInputAdapter(robot),
            send: (message) => events.push(['response', message]), close: () => {},
        });
        handle({ type: 'keyTap', requestId: 'request-1', code: 'Enter', key: 'Enter', direction: 'keydown' });
        expect(events[0]).toEqual(['native', 'enter', 'down']);
        expect(events[1]).toEqual(['response', { status: 'ok', type: 'keyTap', requestId: 'request-1' }]);
        handle({ type: 'keyTap', requestId: 'request-2', code: 'Unknown', key: 'Dead', direction: 'keydown' });
        expect(events.at(-1)[1].status).toBe('error');
        expect(events.at(-1)[1].requestId).toBe('request-2');
        expect(events.at(-1)[1].error.code).toBe('ROBOTJS_BROWSER_KEY_UNSUPPORTED');
    });
});
