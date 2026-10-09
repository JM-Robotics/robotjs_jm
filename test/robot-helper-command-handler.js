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
        handle({ type: 'inputSession', sessionId: 'session-1', active: true, expiresAt: Date.now() + 10000 });
        events.length = 0;
        handle({ type: 'keyTap', sessionId: 'session-1', expiresAt: Date.now() + 10000, requestId: 'request-1', code: 'Enter', key: 'Enter', direction: 'keydown' });
        expect(events[0]).toEqual(['native', 'enter', 'down']);
        expect(events[1]).toEqual(['response', { status: 'ok', type: 'keyTap', requestId: 'request-1' }]);
        handle({ type: 'keyTap', sessionId: 'session-1', expiresAt: Date.now() + 10000, requestId: 'request-2', code: 'Unknown', key: 'Dead', direction: 'keydown' });
        expect(events.at(-1)[1].status).toBe('error');
        expect(events.at(-1)[1].requestId).toBe('request-2');
        expect(events.at(-1)[1].error.code).toBe('ROBOTJS_BROWSER_KEY_UNSUPPORTED');
    });
});

describe('RobotJS native input expiry', () => {
    it('rejects expired and revoked input at execution and always allows release', () => {
        const calls = [];
        const responses = [];
        const handle = createRobotHelperCommandHandler({
            robot: { moveMouse: () => calls.push('move'), scrollMouse: () => calls.push('scroll') },
            inputAdapter: { releaseAll: () => calls.push('release'), keyEvent: () => calls.push('key'), mouseButton: () => calls.push('button') },
            send: (message) => responses.push(message), close: () => {},
        });
        const fresh = { sessionId: 'first', expiresAt: Date.now() + 10000 };
        handle({ type: 'inputSession', ...fresh, active: true });
        expect(responses.at(-1).inputProtectionVersion).toBe(1);
        for (const type of ['mousemove', 'mouseClick', 'scroll', 'keyTap', 'keyToggle']) {
            handle({ type, ...fresh, expiresAt: Date.now() - 1, requestId: type });
            expect(responses.at(-1).error.code).toBe('REMOTE_SUPPORT_INPUT_EXPIRED');
        }
        expect(calls).toEqual(['release']);
        handle({ type: 'inputSession', ...fresh, active: false });
        handle({ type: 'mousemove', ...fresh });
        expect(responses.at(-1).error.code).toBe('REMOTE_SUPPORT_INPUT_EXPIRED');
        handle({ type: 'inputSession', sessionId: 'second', active: true, expiresAt: Date.now() + 10000 });
        handle({ type: 'inputSession', ...fresh, active: false });
        handle({ type: 'mousemove', sessionId: 'second', expiresAt: Date.now() + 10000 });
        expect(responses.at(-1).status).toBe('ok');
        handle({ type: 'releaseInputs', expiresAt: 1 });
        expect(responses.at(-1).status).toBe('ok');
        expect(calls.filter((call) => call === 'move').length).toBe(1);
    });
});
