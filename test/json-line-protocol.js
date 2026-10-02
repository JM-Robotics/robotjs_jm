const {
    createJsonLineDecoder,
    encodeJsonLine,
} = require('../json-line-protocol');

describe('JSON-line helper protocol', () => {
    it('decodes a frame split across TCP chunks', () => {
        const messages = [];
        const errors = [];
        const decoder = createJsonLineDecoder({
            onMessage: (message) => messages.push(message),
            onError: (error) => errors.push(error),
        });

        decoder.push(Buffer.from('{"type":"mouse'));
        decoder.push(Buffer.from('Click","button":"left"}\n'));

        expect(messages).toEqual([{ type: 'mouseClick', button: 'left' }]);
        expect(errors).toEqual([]);
    });

    it('decodes multiple frames combined in one TCP chunk', () => {
        const messages = [];
        const decoder = createJsonLineDecoder({
            onMessage: (message) => messages.push(message),
        });

        decoder.push(Buffer.concat([
            encodeJsonLine({ type: 'mousemove', x: 1, y: 2 }),
            encodeJsonLine({ type: 'mouseClick', clickType: 'down', button: 'left' }),
        ]));

        expect(messages).toEqual([
            { type: 'mousemove', x: 1, y: 2 },
            { type: 'mouseClick', clickType: 'down', button: 'left' },
        ]);
    });

    it('rejects one oversized frame and resumes at the next delimiter', () => {
        const messages = [];
        const errors = [];
        const decoder = createJsonLineDecoder({
            maxFrameBytes: 16,
            onMessage: (message) => messages.push(message),
            onError: (error) => errors.push(error.code),
        });

        decoder.push(Buffer.from('{"payload":"this frame is too large'));
        decoder.push(Buffer.from('"}\n{"ok":true}\n'));

        expect(errors).toEqual(['JSON_LINE_FRAME_TOO_LARGE']);
        expect(messages).toEqual([{ ok: true }]);
    });

    it('rejects malformed JSON without consuming the next frame', () => {
        const messages = [];
        const errors = [];
        const decoder = createJsonLineDecoder({
            onMessage: (message) => messages.push(message),
            onError: (error) => errors.push(error.code),
        });

        decoder.push(Buffer.from('{bad}\n{"ok":true}\n'));

        expect(errors).toEqual(['JSON_LINE_INVALID_JSON']);
        expect(messages).toEqual([{ ok: true }]);
    });
});
