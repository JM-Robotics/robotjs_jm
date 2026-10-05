'use strict';

function serializeError(error) {
    return {
        code: String(error?.code || 'ROBOTJS_COMMAND_FAILED'),
        message: String(error?.message || error || 'RobotJS command failed'),
    };
}

function createRobotHelperCommandHandler({ robot, inputAdapter, send, close }) {
    if (!robot || !inputAdapter || typeof send !== 'function' || typeof close !== 'function') {
        throw new TypeError('Robot helper command handler requires robot, inputAdapter, send, and close');
    }
    return function handleCommand(message = {}) {
        const requestId = String(message.requestId || '');
        try {
            switch (message.type) {
                case 'mousemove': robot.moveMouse(message.x, message.y); break;
                case 'mouseClick': inputAdapter.mouseButton(message.clickType, message.button); break;
                case 'scroll': robot.scrollMouse(message.x, message.y); break;
                case 'keyToggle': robot.keyToggle(message.key, message.direction); break;
                case 'keyTap': inputAdapter.keyEvent(message); break;
                case 'releaseInputs': inputAdapter.releaseAll(); break;
                case 'close':
                    inputAdapter.releaseAll();
                    send({ status: 'ok', type: message.type, requestId });
                    close();
                    return;
                default: {
                    const error = new Error(`Unknown RobotJS helper command '${String(message.type || '')}'`);
                    error.code = 'ROBOTJS_COMMAND_UNKNOWN';
                    throw error;
                }
            }
            send({ status: 'ok', type: message.type, requestId });
        } catch (error) {
            send({ status: 'error', type: message.type, requestId, error: serializeError(error) });
        }
    };
}

module.exports = { createRobotHelperCommandHandler };
