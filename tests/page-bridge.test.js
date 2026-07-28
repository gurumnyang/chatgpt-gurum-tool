/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const { extractFunction, readProjectFile } = require('./helpers/source');

const bridgeFiles = ['content.js', 'fetch-hook.js', 'timestamp-injector.js', 'token-calculator.js'];

test('all page-world bridge participants share one channel and protocol version', () => {
  for (const file of bridgeFiles) {
    const source = readProjectFile(file);
    assert.match(source, /const PAGE_BRIDGE_CHANNEL\s*=\s*['"]chatgpt-gurum-tool['"]/);
    assert.match(source, /const PAGE_BRIDGE_VERSION\s*=\s*1/);
  }
});

test('content-side token responses require the matching requestId and bounded data', () => {
  const source = extractFunction(readProjectFile('content.js'), 'isValidTokenResponse');

  assert.match(source, /isPageBridgeMessage\(data,\s*type\)/);
  assert.match(source, /isValidRequestId\(data\.requestId\)/);
  assert.match(source, /data\.requestId\s*===\s*requestId/);
  assert.match(source, /Number\.isSafeInteger\(data\.tokens\)/);
  assert.match(source, /Number\.isSafeInteger\(data\.chars\)/);
});

test('token calculator rejects foreign messages and correlates a valid response', () => {
  const listeners = [];
  const posted = [];
  const timers = new Map();
  let nextTimerId = 1;
  const window = {
    tiktoken: {
      countTokens(text) {
        return text.length;
      },
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    postMessage(message, targetOrigin) {
      posted.push({ message, targetOrigin });
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    window,
    setTimeout(callback) {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  vm.runInContext(readProjectFile('token-calculator.js'), context, {
    filename: 'token-calculator.js',
  });

  assert.equal(posted[0].message.type, 'TOKEN_CALCULATOR_LOADED');
  const send = (data, source = window) => listeners[0]({ source, data });
  const baseRequest = {
    channel: 'chatgpt-gurum-tool',
    version: 1,
    type: 'CALCULATE_TOKEN_COUNT',
    text: 'hello',
    model: 'gpt-5',
    requestId: 'request-123',
  };

  send({ ...baseRequest, channel: 'foreign-extension' });
  send({ ...baseRequest, version: 2 });
  send({ ...baseRequest, requestId: '' });
  send(baseRequest, {});
  assert.equal(timers.size, 0);

  send(baseRequest);
  assert.equal(timers.size, 1);
  timers.values().next().value();

  const response = posted.at(-1);
  assert.equal(response.targetOrigin, '*');
  assert.deepEqual(
    {
      channel: response.message.channel,
      version: response.message.version,
      type: response.message.type,
      requestId: response.message.requestId,
      tokens: response.message.tokens,
      chars: response.message.chars,
      success: response.message.success,
    },
    {
      channel: 'chatgpt-gurum-tool',
      version: 1,
      type: 'CHATGPT_TOOL_TOKEN_COUNT_RESPONSE',
      requestId: 'request-123',
      tokens: 5,
      chars: 5,
      success: true,
    },
  );
});
