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

robot.setMouseDelay(1);

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
                        break;
                    }
                    case 'scroll': {
                        robot.scrollMouse(message.x, message.y);
                        break;
                    }
                    case 'keyToggle': {
                        //old method used by pilot v <= 1.54
                        robot.keyToggle(message.key, message.direction);
                        break;
                    }
                    case 'keyTap': {
                        keyTap(message);
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

var lastKeyWasCommand = false;
var rightAltModifer = false;

function keyTap(data) {
    setThisCall = false;
    const { normKey, isModifier } = normalizeKey(data.key);
    if (isModifier) {
        console.log(`Toggling normalized key: '${data.key}' => '${normKey}'`);
        if (normKey == 'right_alt') {
            rightAltModifer = data.direction === 'down';
        } else {
          robot.keyToggle(normKey, data.direction);
        }

        if (normKey === 'command') {
            if (data.direction === 'down') {
                lastKeyWasCommand = true;
                setThisCall = true;
            } else {
                lastKeyWasCommand = false;
            }
        }
    } else {
        if (data.keyCode > 127 && data.key.length === 1) {
            if (data.direction === 'down') {
                const charFromKey = data.key.charCodeAt(0);
                console.log(`unicodeTap: '${data.keyCode}', '${data.key}'  => ('${charFromKey}')`);
                robot.unicodeTap(charFromKey);
            }
        } else {
            const charFromCode = String.fromCharCode(data.keyCode);
            console.log(`keyToggling keyCode: '${data.keyCode}', '${data.key}' => ('${charFromCode}'). Direction: ${data.direction}, rightAltModifier: ${rightAltModifer ? 'right_alt' : []}`);
            robot.keyToggle(charFromCode, data.direction, rightAltModifer ? 'right_alt' : []);
        }
    }
    if (lastKeyWasCommand && !setThisCall) {
        robot.keyToggle('command', 'up');
        lastKeyWasCommand = false;
    }
}

function normalizeKey(key) {
    let normKey = key.toLowerCase();
    let isModifier = false;
    const RIGHTALTKEYSNAMES = ['right_alt', 'altgr', 'altgraph'];
    const LEFTALTKEYSNAMES = ['alt', 'left_alt', 'leftalt'];
    const SHIFTKEYSNAMES = ['shift'];
    const CONTROLKEYSNAMES = ['control', 'ctrl'];
    const METAKEYSNAMES = ['meta', 'windows', 'win', 'command'];

    const MODIFERS = {
        right_alt: RIGHTALTKEYSNAMES,
        alt: LEFTALTKEYSNAMES,
        shift: SHIFTKEYSNAMES,
        control: CONTROLKEYSNAMES,
        command: METAKEYSNAMES,
    };
    for (let modifierType of Object.keys(MODIFERS)) {
        if (MODIFERS[modifierType].includes(normKey)) {
            normKey = modifierType;
            isModifier = true;
            break;
        }
    }

    if (normKey === 'capslock') normKey = 'caps_lock';
    if (normKey === 'backspace') normKey = 'backspace';
    if (normKey === 'tab') normKey = 'tab';
    if (normKey === 'enter') normKey = 'enter';
    if (normKey === 'return') normKey = 'enter';
    if (normKey === 'escape') normKey = 'escape';
    if (normKey === 'esc') normKey = 'escape';
    if (normKey != ' ' && normKey.trim() === '') normKey = undefined;

    //console.log('mapped key:', `'${key}' => '${normKey}'`);
    return { normKey, isModifier };
}

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

//
