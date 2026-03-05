// Track currently pressed modifier keys
const activeModifiers = new Set();

const { dir } = require('console');
const net = require('net');
const path = require('path');

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// This will look for prebuilds/*/*.node relative to baseDir
const robot = require('node-gyp-build')(baseDir);

const DEFAULT_PORT = 13337;
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

const MODIFIERKEYSNAMES = ['alt', 'right_alt', 'shift', 'control', 'command'];
robot.setMouseDelay(1);

var lastKeyWasCommand = false;

function specialMap(key) {
    const specialCharMap = {
        '!': '1',
        '"': '2',
        '#': '3',
        $: '4',
        '%': '5',
        '&': '6',
        '/': '7',
        '(': '8',
        ')': '9',
        '=': '0',

        '@': '2',
        '{': '7',
        '[': '8',
        ']': '9',
        '}': '0',

        '|': '<',
        '\\': '<',

        '~': '+',
        '^': '^',
        '?': '+',

        '*': "'",
        "'": "'",

        ':': '.',
        ';': ',',

        '>': '.',
        '<': '<',

        _: '-',
        '+': '+',
    };
    if (specialCharMap[key]) {
        console.log(`Special character '${key}' mapped to '${specialCharMap[key]}' `);
        return specialCharMap[key];
    }
    return key;
}

const server = net.createServer((socket) => {
    socket.on('data', async (data) => {
        let message;
        try {
            message = JSON.parse(data.toString('utf-8'));
        } catch (error) {
            socket.write('{"status": "error", "message: "' + data.toString('utf-8') + '", "error": "' + error.message + '"}');
        }
        if (message) {
            try {
                switch (message.type) {
                    case 'mousemove': {
                        robot.moveMouse(message.x, message.y);
                        break;
                    }
                    case 'mouseClick': {
                        robot.mouseToggle(message.clickType, message.button);
                        //console.log(message.clickType, message.button, "Ok")
                        break;
                    }
                    case 'scroll': {
                        robot.scrollMouse(message.x, message.y);
                        //console.log(message.type, "Ok")
                        break;
                    }
                    case 'keyToggle': {
                        if (typeof message.key === 'string' && message.key.length === 1 && message.key.charCodeAt(0) > 127) {
                            if (message.direction === 'down') {
                                console.log('Unicode tap', message.key, message.key.charCodeAt(0));
                                robot.unicodeTap(message.key.charCodeAt(0));
                            }
                            return; // Don't proceed to keyToggle for unicode characters
                        }

                        //normalize key altGraph to right_alt etc.
                        const direction = message.direction;
                        let normKey = reMapKey(message.key);

                        // Track modifier state
                        if (MODIFIERKEYSNAMES.includes(normKey)) {
                            if (message.direction === 'down') {
                                activeModifiers.add(normKey);
                            }
                            if (message.direction === 'up') {
                                activeModifiers.delete(normKey);
                            }
                        } else {
                          // Check if the key is a special character that needs modifiers
                            //normKey = specialMap(normKey);
                        }


                        try {
                            robot.keyToggle(normKey, direction);

                            //as command may remove focus from sending window, add this to make sure it is relased.
                            if (lastKeyWasCommand && normKey != "command" && direction === 'up') {
                                lastKeyWasCommand = false;
                                activeModifiers.delete('command'); // Clear command key to prevent it getting stuck. Command is usually a single key modifier and not used in combinations, so this is a simple way to prevent it from getting stuck.
                                robot.keyToggle('command', 'up');
                            }
                            if (normKey === 'command' && direction === 'down') {
                                lastKeyWasCommand = true;
                            }

                        } catch (error) {
                            console.error(`Error in keyToggle for key '${normKey}', '${normKey.charCodeAt(0)}', with direction '${direction}':`);
                            console.error(error.message, error);
                        }

                        break;
                    }
                    case 'close':
                        socket.write('{"status": "ok", "message": "Shutting down"}');
                        console.log('Shutdown command received. Closing server...');
                        server.close(() => {
                            console.log('Server closed.');
                            process.exit(0);
                        });

                        // Force-close all active sockets
                        sockets.forEach((s) => s.destroy());
                        break;
                    default:
                        console.warn('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('Failed to process command', error);
                socket.write('{"status": "error", "type": "' + message.type + '", "error": "' + error.message + '"}');
            }
        }
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
    });

    socket.on('close', () => {
        console.log('Client disconnected.');
    });
});

server.listen(port, () => {
    console.log(`RobotJS Helper listening on port ${port} (admin)`);
});

function reMapKey(key) {
    let normKey = key.toLowerCase();
    const RIGHTALTKEYSNAMES = ['right_alt', 'altgr', 'altgraph'];
    const LEFTALTKEYSNAMES = ['alt', 'left_alt', 'leftalt'];
    const SHIFTKEYSNAMES = ['shift'];
    const CONTROLKEYSNAMES = ['control', 'ctrl'];
    const METAKEYSNAMES = ['meta', 'windows', 'win', 'command'];

    if (RIGHTALTKEYSNAMES.includes(normKey)) normKey = 'right_alt';
    if (LEFTALTKEYSNAMES.includes(normKey)) normKey = 'alt';
    if (SHIFTKEYSNAMES.includes(normKey)) normKey = 'shift';
    if (CONTROLKEYSNAMES.includes(normKey)) normKey = 'control';
    if (METAKEYSNAMES.includes(normKey)) normKey = 'command';

    if (normKey === 'capslock') normKey = 'caps_lock';
    if (normKey === 'backspace') normKey = 'backspace';
    if (normKey === 'tab') normKey = 'tab';
    if (normKey === 'enter') normKey = 'enter';
    if (normKey === 'return') normKey = 'enter';
    if (normKey === 'escape') normKey = 'escape';
    if (normKey === 'esc') normKey = 'escape';
    if (normKey != ' ' && normKey.trim() === '') normKey = undefined;

    //console.log('mapped key:', `'${key}' => '${normKey}'`);
    return normKey;
}

//
