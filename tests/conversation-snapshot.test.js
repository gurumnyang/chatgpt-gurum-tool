/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const { readProjectFile } = require('./helpers/source');

function loadSnapshotHelper(window = {}) {
  const context = vm.createContext({ window });
  vm.runInContext(readProjectFile('conversation-snapshot.js'), context, {
    filename: 'conversation-snapshot.js',
  });
  return window.GurumConversationSnapshot;
}

function messageNode(id, role, parent, children, text, options = {}) {
  return {
    id,
    parent,
    children,
    message: {
      id: `message-${id}`,
      author: { role },
      content: {
        content_type: options.contentType || 'text',
        parts: [text],
      },
      metadata: options.hidden ? { is_visually_hidden_from_conversation: true } : {},
      recipient: options.recipient,
      create_time: 1_700_000_000,
    },
  };
}

function linearConversation(count) {
  const mapping = {
    root: { id: 'root', parent: null, children: ['n1'], message: null },
  };
  for (let index = 1; index <= count; index += 1) {
    mapping[`n${index}`] = messageNode(
      `n${index}`,
      index % 2 ? 'user' : 'assistant',
      index === 1 ? 'root' : `n${index - 1}`,
      index === count ? [] : [`n${index + 1}`],
      `content-${index}`,
    );
  }
  return {
    conversation_id: 'conversation-long',
    current_node: `n${count}`,
    mapping,
  };
}

test('full API snapshot is independent from ChatGPT virtualized DOM window size', () => {
  const helper = loadSnapshotHelper();
  const snapshot = helper.buildConversationSnapshot(linearConversation(106));

  assert.equal(snapshot.messageCount, 106);
  assert.equal(snapshot.messages[0].content, 'content-1');
  assert.equal(snapshot.messages.at(-1).content, 'content-106');

  const virtualizedDomWindow = snapshot.messages.slice(-10).map((message) => ({
    id: message.id,
    turnId: message.nodeId,
    sender: message.sender,
    content: message.content,
  }));
  const merged = helper.mergeDomMessages(snapshot, virtualizedDomWindow);
  assert.equal(merged.messageCount, 106);
  assert.equal(merged.text, snapshot.text);
});

test('snapshot follows only the active branch and excludes internal messages', () => {
  const helper = loadSnapshotHelper();
  const payload = linearConversation(4);
  payload.mapping.n2.children.push('alternate');
  payload.mapping.alternate = messageNode('alternate', 'assistant', 'n2', [], 'inactive branch');
  payload.mapping.n2.children = ['alternate', 'hidden'];
  payload.mapping.hidden = messageNode('hidden', 'assistant', 'n2', ['tool'], 'hidden', {
    hidden: true,
  });
  payload.mapping.tool = messageNode('tool', 'assistant', 'hidden', ['n3'], 'tool call', {
    recipient: 'python',
  });
  payload.mapping.n3.parent = 'tool';

  const snapshot = helper.buildConversationSnapshot(payload);

  assert.deepEqual(
    Array.from(snapshot.messages, (message) => message.content),
    ['content-1', 'content-2', 'content-3', 'content-4'],
  );
});

test('export text removes Gurum-generated prompt metadata while context text retains it', () => {
  const helper = loadSnapshotHelper();
  const payload = linearConversation(2);
  payload.mapping.n1.message.content.parts = [
    '<info>\n//Generated automatically\nCurrent: 2026-07-28\nformal\n</info>\nvisible prompt',
  ];

  const snapshot = helper.buildConversationSnapshot(payload);

  assert.equal(snapshot.messages[0].content, 'visible prompt');
  assert.match(snapshot.text, /Generated automatically/);
  assert.match(snapshot.text, /visible prompt/);
});

test('newly streamed DOM turns are appended once until the next API snapshot', () => {
  const helper = loadSnapshotHelper();
  const snapshot = helper.buildConversationSnapshot(linearConversation(4));
  const merged = helper.mergeDomMessages(snapshot, [
    {
      id: 'message-n4',
      turnId: 'n4',
      sender: 'assistant',
      content: 'content-4',
    },
    {
      id: 'message-n5',
      turnId: 'n5',
      sender: 'user',
      content: 'new prompt',
    },
  ]);

  assert.equal(merged.messageCount, 5);
  assert.equal(merged.messages.at(-1).content, 'new prompt');
  assert.equal(merged.text, `${snapshot.text}new prompt`);
});

test('fetch hook caches the full snapshot without modifying the site response', async () => {
  const listeners = [];
  const posted = [];
  const payload = linearConversation(40);
  const originalResponse = new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  const window = {
    location: { origin: 'https://chatgpt.com' },
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    postMessage(message) {
      posted.push(message);
    },
    async fetch() {
      return originalResponse;
    },
  };
  const context = vm.createContext({
    Headers,
    Request,
    Response,
    URL,
    console: { log() {}, warn() {}, error() {} },
    window,
  });
  vm.runInContext(readProjectFile('conversation-snapshot.js'), context, {
    filename: 'conversation-snapshot.js',
  });
  vm.runInContext(readProjectFile('fetch-hook.js'), context, {
    filename: 'fetch-hook.js',
  });

  const response = await window.fetch(
    'https://chatgpt.com/backend-api/conversation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  );
  assert.equal(response, originalResponse);
  assert.equal(Object.keys(await response.clone().json()).length, 3);
  await new Promise((resolve) => setImmediate(resolve));

  for (const listener of listeners) {
    listener({
      source: window,
      data: {
        channel: 'chatgpt-gurum-tool',
        version: 1,
        type: 'GURUM_CONVERSATION_SNAPSHOT_REQUEST',
        requestId: 'snapshot-request',
        conversationId: 'conversation-long',
        domMessages: [],
      },
    });
  }
  const result = posted.find((message) => message.type === 'GURUM_CONVERSATION_SNAPSHOT_RESPONSE');
  assert.equal(result.snapshot.messageCount, 40);
  assert.equal(result.snapshot.messages[0].content, 'content-1');
  assert.equal(result.snapshot.messages.at(-1).content, 'content-40');
});
