/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const { readJson, readProjectFile } = require('./helpers/source');

const limitsSource = readProjectFile('background/limits.js');
const packagedDocument = readJson('config/plan-limits.json');

function jsonLiteral(value) {
  return JSON.stringify(JSON.stringify(value));
}

function createLimitsHarness() {
  const context = vm.createContext({});
  vm.runInContext(
    `
      globalThis.self = globalThis;
      globalThis.__storage = {};
      globalThis.__fetchResponses = [];
      globalThis.__fetchCalls = [];
      globalThis.console = { log() {}, warn() {}, error() {} };
      globalThis.chrome = {
        runtime: {
          getURL(path) {
            return 'chrome-extension://test/' + path;
          },
        },
        storage: {
          local: {
            async get(keys, callback) {
              const requested = Array.isArray(keys) ? keys : [keys];
              const result = {};
              for (const key of requested) {
                if (Object.prototype.hasOwnProperty.call(__storage, key)) {
                  result[key] = __storage[key];
                }
              }
              if (typeof callback === 'function') callback(result);
              return result;
            },
            async set(values) {
              Object.assign(__storage, values);
            },
          },
        },
      };
      globalThis.fetch = async (url) => {
        __fetchCalls.push(String(url));
        const response = __fetchResponses.shift();
        if (!response) throw new Error('Unexpected fetch: ' + url);
        return {
          ok: response.ok !== false,
          status: response.status || 200,
          async json() {
            return response.body;
          },
        };
      };
    `,
    context,
  );
  vm.runInContext(limitsSource, context, { filename: 'background/limits.js' });

  return {
    context,
    evaluate(expression) {
      return vm.runInContext(expression, context);
    },
    setStorage(key, value) {
      vm.runInContext(
        `__storage[${JSON.stringify(key)}] = JSON.parse(${jsonLiteral(value)})`,
        context,
      );
    },
    enqueueFetch(body, options = {}) {
      vm.runInContext(
        `__fetchResponses.push({
          ok: ${options.ok !== false},
          status: ${options.status || 200},
          body: JSON.parse(${jsonLiteral(body)})
        })`,
        context,
      );
    },
    validate(value) {
      context.__candidateJson = JSON.stringify(value);
      return vm.runInContext(
        'self.__GURUM_BG__.validatePlanLimitsDocument(JSON.parse(__candidateJson)) !== null',
        context,
      );
    },
  };
}

test('packaged plan-limits document is accepted by the runtime validator', () => {
  const harness = createLimitsHarness();
  assert.equal(harness.validate(packagedDocument), true);
});

test('validator accepts a future model with a safe canonical key', () => {
  const candidate = structuredClone(packagedDocument);
  candidate.plans.plus['gpt-6-preview'] = {
    type: 'weekly',
    value: 100,
    displayName: 'GPT-6 Preview',
    detect: ['gpt-6-preview'],
  };

  assert.equal(createLimitsHarness().validate(candidate), true);
});

test('validator rejects unsafe or malformed remote configuration', async (t) => {
  const cases = [
    [
      'unknown top-level key',
      (document) => {
        document.untrusted = true;
      },
    ],
    [
      'missing required plan',
      (document) => {
        delete document.plans.team;
      },
    ],
    [
      'unsafe model key',
      (document) => {
        document.plans.free['<script>'] = document.plans.free['gpt-5-5-instant'];
      },
    ],
    [
      'HTML-bearing display name',
      (document) => {
        document.plans.free['gpt-5-5-instant'].displayName = '<img src=x>';
      },
    ],
    [
      'duplicate detection alias',
      (document) => {
        document.plans.free['gpt-5-5-instant'].detect = ['auto', 'auto'];
      },
    ],
    [
      'unlimited entry with numeric value',
      (document) => {
        document.plans.pro.o3.value = 1;
      },
    ],
    [
      'out-of-range limit',
      (document) => {
        document.plans.plus.o3.value = 1_000_000_001;
      },
    ],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const candidate = structuredClone(packagedDocument);
      mutate(candidate);
      assert.equal(createLimitsHarness().validate(candidate), false);
    });
  }
});

test('last-known-good storage wins without fetching the packaged document', async () => {
  const harness = createLimitsHarness();
  const lkg = structuredClone(packagedDocument.plans);
  lkg.free['deep-research'].value = 7;
  harness.setStorage('planLimitsAll', lkg);

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.free['deep-research'].value, 7);
  assert.equal(harness.evaluate('__fetchCalls.length'), 0);
});

test('invalid storage falls back to the validated packaged document', async () => {
  const harness = createLimitsHarness();
  harness.setStorage('planLimitsAll', { free: {} });
  harness.enqueueFetch(packagedDocument);

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.plus['gpt-5-5-thinking'].value, 3000);
  assert.deepEqual(Array.from(harness.evaluate('__fetchCalls')), [
    'chrome-extension://test/config/plan-limits.json',
  ]);
});

test('invalid packaged data falls back to built-in safe defaults', async () => {
  const harness = createLimitsHarness();
  harness.setStorage('planLimitsAll', { free: {} });
  harness.enqueueFetch({ plans: { free: {} } });

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.free['gpt-5'].displayName, 'GPT-5');
  assert.equal(limits.free['deep-research'].value, 5);
});
