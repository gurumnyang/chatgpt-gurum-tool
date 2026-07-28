/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const { readJson, readProjectFile } = require('./helpers/source');

function createUsageHarness() {
  const context = vm.createContext({
    URL,
    console: { log() {}, warn() {}, error() {} },
  });
  context.self = context;
  context.chrome = {};
  vm.runInContext(readProjectFile('background/usage.js'), context, {
    filename: 'background/usage.js',
  });
  return context.self.__GURUM_BG__;
}

test('background counts only exact multi-prefix conversation POST endpoints', () => {
  const { isConversationSendEndpoint } = createUsageHarness();
  for (const url of [
    'https://chatgpt.com/backend-api/conversation',
    'https://chatgpt.com/backend-api/f/conversation?arkose=1',
    'https://chatgpt.com/backend-api/foo/bar/conversation/',
  ]) {
    assert.equal(isConversationSendEndpoint(url), true, url);
  }
  for (const url of [
    'https://chatgpt.com/backend-api/conversation/init',
    'https://chatgpt.com/backend-api/f/conversation/init',
    'https://chatgpt.com/backend-api/conversation/01234567-89ab-cdef-0123-456789abcdef',
    'https://chatgpt.com/backend-api/conversation/extra/path',
    'https://evil.example/backend-api/conversation',
  ]) {
    assert.equal(isConversationSendEndpoint(url), false, url);
  }
});

test('GPT-5.3, GPT-5.5, and GPT-5.6 slugs keep independent counters', () => {
  const { resolveCanonicalModel } = createUsageHarness();
  const limits = readJson('config/plan-limits.json').plans.team;

  assert.equal(resolveCanonicalModel('gpt-5-6-thinking', limits, 'plus'), 'gpt-5-6-sol');
  assert.equal(resolveCanonicalModel('gpt-5-6', limits, 'plus'), 'gpt-5-6-sol');
  assert.equal(resolveCanonicalModel('gpt-5-3-instant', limits, 'team'), 'gpt-5-3-instant');
  assert.equal(resolveCanonicalModel('gpt-5-5-thinking', limits, 'team'), 'gpt-5-5-thinking');
  assert.equal(resolveCanonicalModel('gpt-5-5-pro', limits, 'team'), 'gpt-5-5-pro');
});

function createFetchHookHarness(responseData = {}) {
  const listeners = [];
  const posted = [];
  const calls = [];
  const response = {
    clone() {
      return {
        async json() {
          return responseData;
        },
      };
    },
  };
  const window = {
    location: { origin: 'https://chatgpt.com' },
    async fetch(input, init) {
      calls.push({ input, init });
      return response;
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    postMessage(message) {
      posted.push(message);
    },
  };
  const context = vm.createContext({
    Headers,
    Request,
    URL,
    console: { log() {}, warn() {}, error() {} },
    window,
  });
  vm.runInContext(readProjectFile('fetch-hook.js'), context, { filename: 'fetch-hook.js' });
  return {
    calls,
    posted,
    sendPageMessage(data) {
      listeners[0]({ source: window, data });
    },
    fetch: (...args) => window.fetch(...args),
  };
}

test('fetch hook applies the same exact send routing to relative and absolute URLs', async () => {
  const harness = createFetchHookHarness();
  harness.sendPageMessage({
    channel: 'chatgpt-gurum-tool',
    version: 1,
    type: 'GURUM_PROMPT_STATE',
    payload: { promptText: 'bridge prompt' },
  });
  const body = JSON.stringify({
    model: 'gpt-5-6-thinking',
    messages: [{ content: { parts: ['hello'] } }],
  });

  await harness.fetch('/backend-api/foo/bar/conversation', { method: 'POST', body });
  await harness.fetch('https://chatgpt.com/backend-api/foo/bar/conversation', {
    method: 'POST',
    body,
  });
  await harness.fetch('/backend-api/foo/bar/conversation/init', { method: 'POST', body });
  await harness.fetch(
    'https://chatgpt.com/backend-api/foo/bar/conversation/01234567-89ab-cdef-0123-456789abcdef',
    { method: 'POST', body },
  );
  await harness.fetch('https://evil.example/backend-api/foo/bar/conversation', {
    method: 'POST',
    body,
  });

  assert.match(harness.calls[0].init.body, /bridge prompt/);
  assert.match(harness.calls[1].init.body, /bridge prompt/);
  assert.equal(harness.calls[2].init.body, body);
  assert.equal(harness.calls[3].init.body, body);
  assert.equal(harness.calls[4].init.body, body);
});

test('conversation init accepts explicit usage shape and optional reset metadata', async () => {
  const harness = createFetchHookHarness({
    usage: {
      deep_research: {
        remaining_count: 12,
      },
      image_generation: {
        remaining_count: 4,
      },
    },
  });

  await harness.fetch('/backend-api/sentinel/conversation/init');
  await new Promise((resolve) => setImmediate(resolve));

  const deepResearchMessage = harness.posted.find(
    (message) => message.type === 'CHATGPT_TOOL_DEEP_RESEARCH_INFO',
  );
  const imageGenerationMessage = harness.posted.find(
    (message) => message.type === 'CHATGPT_TOOL_IMAGE_GENERATION_INFO',
  );
  assert.deepEqual(
    {
      type: deepResearchMessage.type,
      feature_name: deepResearchMessage.info.feature_name,
      remaining: deepResearchMessage.info.remaining,
      hasReset: Object.prototype.hasOwnProperty.call(deepResearchMessage.info, 'reset_after'),
    },
    {
      type: 'CHATGPT_TOOL_DEEP_RESEARCH_INFO',
      feature_name: 'deep_research',
      remaining: 12,
      hasReset: false,
    },
  );
  assert.deepEqual(
    {
      type: imageGenerationMessage.type,
      feature_name: imageGenerationMessage.info.feature_name,
      remaining: imageGenerationMessage.info.remaining,
      hasReset: Object.prototype.hasOwnProperty.call(imageGenerationMessage.info, 'reset_after'),
    },
    {
      type: 'CHATGPT_TOOL_IMAGE_GENERATION_INFO',
      feature_name: 'image_gen',
      remaining: 4,
      hasReset: false,
    },
  );
});
