/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');

const { extractFunction, readProjectFile } = require('./helpers/source');

const contentSource = readProjectFile('content.js');

function loadFunction(name, document) {
  const source = extractFunction(contentSource, name);
  return Function('document', `${source}; return ${name};`)(document);
}

function createElement(attributes = {}, options = {}) {
  const removed = { value: false };
  const element = {
    className: options.className || '',
    currentSrc: options.currentSrc || '',
    innerHTML: options.innerHTML || '',
    textContent: options.textContent || '',
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    querySelector(selector) {
      return options.selectors?.[selector] || null;
    },
    querySelectorAll(selector) {
      return options.selectorLists?.[selector] || [];
    },
    cloneNode() {
      return options.clone || element;
    },
    remove() {
      removed.value = true;
    },
    removed,
  };
  return element;
}

test('getScrollTarget prioritizes the explicit conversation scroll root', () => {
  const scrollRoot = createElement();
  const sidebar = createElement({}, { className: 'flex flex-col h-full overflow-y-auto' });
  const document = {
    querySelector: (selector) => (selector === '[data-scroll-root]' ? scrollRoot : null),
    querySelectorAll: () => [sidebar],
    scrollingElement: createElement(),
  };

  assert.equal(loadFunction('getScrollTarget', document)(), scrollRoot);
});

test('getScrollTarget preserves legacy overflow and document fallbacks', () => {
  const weakCandidate = createElement({}, { className: 'overflow-y-auto' });
  const fullCandidate = createElement({}, { className: 'flex flex-col h-full overflow-y-auto' });
  const documentFallback = createElement();
  const document = {
    querySelector: () => null,
    querySelectorAll: () => [weakCandidate, fullCandidate],
    scrollingElement: documentFallback,
  };
  const getScrollTarget = loadFunction('getScrollTarget', document);

  assert.equal(getScrollTarget(), fullCandidate);
  document.querySelectorAll = () => [];
  assert.equal(getScrollTarget(), documentFallback);
});

test('extractConversation keeps message ids and exports wrapperless image turns by turn id', () => {
  const decorativeIcon = createElement({ src: 'https://example.com/favicon.ico', alt: '' });
  const textContent = createElement(
    {},
    {
      innerHTML: '<p>hello</p>',
      textContent: 'hello',
      selectorLists: { img: [decorativeIcon] },
    },
  );
  const textClone = createElement(
    {},
    {
      selectors: { 'div.markdown': textContent },
      selectorLists: {},
    },
  );
  const message = createElement(
    {
      'data-message-id': 'message-1',
      'data-message-author-role': 'user',
    },
    { clone: textClone },
  );
  const normalTurn = createElement(
    { 'data-turn-id': 'turn-1', 'data-turn': 'user' },
    {
      selectorLists: {
        'div[data-message-author-role][data-message-id]': [message],
      },
    },
  );

  const visibleImage = createElement({
    src: 'https://chatgpt.com/backend-api/estuary/content?id=image-1',
    alt: 'generated dashboard',
  });
  const duplicateImage = createElement({
    src: 'https://chatgpt.com/backend-api/estuary/content?id=image-1',
    alt: '',
    'aria-hidden': 'true',
  });
  const unsafeImage = createElement({ src: 'javascript:alert(1)', alt: 'unsafe' });
  const imageContent = createElement(
    {},
    {
      innerHTML:
        '<figure><img alt="generated dashboard" src="https://chatgpt.com/backend-api/estuary/content?id=image-1"></figure>',
      textContent: '',
      selectorLists: { img: [visibleImage, duplicateImage, unsafeImage] },
    },
  );
  const imageClone = createElement(
    {},
    {
      selectors: { '[data-conversation-screenshot-content]': imageContent },
      selectorLists: {},
    },
  );
  const imageTurn = createElement(
    { 'data-turn-id': 'turn-image', 'data-turn': 'assistant' },
    {
      clone: imageClone,
      selectorLists: {
        'div[data-message-author-role][data-message-id]': [],
      },
    },
  );

  const document = {
    querySelectorAll(selector) {
      if (selector === "[data-testid^='conversation-turn']") return [normalTurn, imageTurn];
      return [];
    },
  };
  const extractConversation = loadFunction('extractConversation', document);
  const conversation = extractConversation();

  assert.deepEqual(conversation, [
    {
      id: 'message-1',
      turnId: 'turn-1',
      sender: 'user',
      html: '<p>hello</p>',
      content: 'hello',
    },
    {
      id: 'turn-image',
      turnId: 'turn-image',
      sender: 'assistant',
      html: imageContent.innerHTML,
      content:
        '[Image: generated dashboard]\n' +
        'https://chatgpt.com/backend-api/estuary/content?id=image-1',
    },
  ]);
  assert.equal(duplicateImage.removed.value, true);
  assert.equal(unsafeImage.removed.value, true);
  assert.equal(decorativeIcon.removed.value, true);
});

test('extractConversation applies startId and endId to wrapperless turn ids', () => {
  function imageTurn(id, alt) {
    const image = createElement({ src: `https://example.com/${id}.png`, alt });
    const content = createElement(
      {},
      {
        innerHTML: `<img src="https://example.com/${id}.png" alt="${alt}">`,
        selectorLists: { img: [image] },
      },
    );
    return createElement(
      { 'data-turn-id': id, 'data-turn': 'assistant' },
      {
        clone: createElement(
          {},
          {
            selectors: { '[data-conversation-screenshot-content]': content },
            selectorLists: {},
          },
        ),
        selectorLists: {
          'div[data-message-author-role][data-message-id]': [],
        },
      },
    );
  }

  const turns = [
    imageTurn('before', 'before'),
    imageTurn('start', 'start'),
    imageTurn('end', 'end'),
  ];
  const document = {
    querySelectorAll: (selector) =>
      selector === "[data-testid^='conversation-turn']" ? turns : [],
  };

  assert.deepEqual(
    loadFunction('extractConversation', document)('start', 'end').map(({ id }) => id),
    ['start', 'end'],
  );
});

test('DOM fallback is rejected when ChatGPT virtualizes most long-session turns', () => {
  const source = extractFunction(contentSource, 'extractCompleteDomConversation');
  const extractCompleteDomConversation = Function(
    'document',
    'extractConversation',
    `${source}; return extractCompleteDomConversation;`,
  )(
    {
      querySelectorAll(selector) {
        const count = selector === '[data-turn-id-container]' ? 107 : 10;
        return Array.from({ length: count }, (_, index) => ({
          getAttribute(name) {
            if (name === 'data-turn-id-container' || name === 'data-turn-id') {
              return `turn-${index}`;
            }
            return null;
          },
        }));
      },
    },
    () => [{ id: 'mounted-only' }],
  );

  assert.equal(extractCompleteDomConversation(), null);
});

test('DOM fallback remains available when all visible turns are mounted', () => {
  const source = extractFunction(contentSource, 'extractCompleteDomConversation');
  const conversation = [{ id: 'complete' }];
  const extractCompleteDomConversation = Function(
    'document',
    'extractConversation',
    `${source}; return extractCompleteDomConversation;`,
  )(
    {
      querySelectorAll(selector) {
        const count = selector === '[data-turn-id-container]' ? 8 : 7;
        return Array.from({ length: count }, (_, index) => ({
          getAttribute(name) {
            if (name === 'data-turn-id-container' || name === 'data-turn-id') {
              return `turn-${index}`;
            }
            return null;
          },
        }));
      },
    },
    () => conversation,
  );

  assert.equal(extractCompleteDomConversation(), conversation);
});
