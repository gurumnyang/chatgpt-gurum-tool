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

test('active and legacy GPT models preserve limits and display order', () => {
  assert.equal(packagedDocument.version, '2026-07-28.1');
  assert.equal(packagedDocument.plans.free['gpt-5-6-sol'], undefined);
  assert.equal(packagedDocument.plans.free['gpt-5-5-instant'].type, 'dynamic');
  assert.equal(packagedDocument.plans.go['gpt-5-6-sol'], undefined);
  assert.equal(packagedDocument.plans.go['gpt-5-5-instant'].value, 160);
  assert.equal(packagedDocument.plans.go['gpt-5-3-instant'].value, 160);
  assert.equal(packagedDocument.plans.go['gpt-5-5-thinking'].value, 10);
  for (const plan of ['plus', 'team']) {
    const sol = packagedDocument.plans[plan]['gpt-5-6-sol'];
    assert.equal(sol.type, 'weekly');
    assert.equal(sol.value, 3000);
    assert.ok(sol.detect.includes('gpt-5-6-thinking'));
    assert.ok(!sol.detect.includes('gpt-5-5-thinking'));
    assert.equal(packagedDocument.plans[plan]['gpt-5-5-thinking'].value, 3000);
  }
  assert.equal(packagedDocument.plans.team['gpt-5-6-pro'].type, 'monthly');
  assert.equal(packagedDocument.plans.team['gpt-5-6-pro'].value, 15);
  assert.equal(packagedDocument.plans.team['gpt-5-5-pro'].type, 'monthly');
  assert.equal(packagedDocument.plans.team['gpt-5-5-pro'].value, 15);
  assert.equal(packagedDocument.plans.pro['gpt-5-6-sol'].type, 'unlimited');
  assert.equal(packagedDocument.plans.pro['gpt-5-6-pro'].type, 'unlimited');
  assert.equal(packagedDocument.plans.pro['gpt-5-5-thinking'].type, 'unlimited');
  assert.equal(packagedDocument.plans.pro['gpt-5-5-pro'].type, 'unlimited');
  const deepResearchLimits = { free: 5, go: 5, plus: 25, team: 25, pro: 250 };
  for (const [plan, value] of Object.entries(deepResearchLimits)) {
    assert.equal(packagedDocument.plans[plan]['deep-research'].type, 'monthly');
    assert.equal(packagedDocument.plans[plan]['deep-research'].value, value);
  }
  assert.equal(packagedDocument.plans.pro['gpt-4-5'], undefined);
  for (const plan of Object.values(packagedDocument.plans)) {
    assert.equal(plan['gpt-5-t-mini'], undefined);
    assert.equal(plan['gpt-5-4-thinking'], undefined);
    assert.equal(plan['gpt-5-4-pro'], undefined);
  }

  assert.deepEqual(Object.keys(packagedDocument.plans.plus), [
    'gpt-5-5-instant',
    'gpt-5-6-sol',
    'gpt-5-3-instant',
    'gpt-5-5-thinking',
    'o3',
    'deep-research',
  ]);
  assert.deepEqual(Object.keys(packagedDocument.plans.team), [
    'gpt-5-5-instant',
    'gpt-5-6-sol',
    'gpt-5-6-pro',
    'gpt-5-3-instant',
    'gpt-5-5-thinking',
    'gpt-5-5-pro',
    'o3',
    'deep-research',
  ]);
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

test('dated last-known-good storage wins over an older packaged document', async () => {
  const harness = createLimitsHarness();
  const lkg = structuredClone(packagedDocument.plans);
  lkg.plus.o3.value = 101;
  harness.setStorage('planLimitsAll', lkg);
  harness.setStorage('planLimitsUpdatedAt', '2026-08-01T00:00:00Z');
  harness.enqueueFetch(packagedDocument);

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.plus.o3.value, 101);
});

test('legacy storage without recency metadata cannot downgrade the packaged policy', async () => {
  const harness = createLimitsHarness();
  const legacy = structuredClone(packagedDocument.plans);
  delete legacy.plus['gpt-5-6-sol'];
  harness.setStorage('planLimitsAll', legacy);
  harness.enqueueFetch(packagedDocument);

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.plus['gpt-5-6-sol'].type, 'weekly');
});

test('remote sync cannot replace a newer packaged policy with an older remote document', async () => {
  const harness = createLimitsHarness();
  const oldRemote = structuredClone(packagedDocument);
  oldRemote.version = '2026-05-28';
  oldRemote.updatedAt = '2026-05-28T00:00:00Z';
  delete oldRemote.plans.plus['gpt-5-6-sol'];
  harness.enqueueFetch(oldRemote);
  harness.enqueueFetch(packagedDocument);

  const result = await harness.evaluate('self.__GURUM_BG__.refreshPlanLimitsFromRemote("plus")');

  assert.equal(result.version, '2026-07-28.1');
  assert.equal(harness.evaluate('__storage.limits["gpt-5-6-sol"].type'), 'weekly');
  assert.equal(harness.evaluate('__storage.planLimitsUpdatedAt'), '2026-07-28T12:00:00Z');
});

test('invalid storage falls back to the validated packaged document', async () => {
  const harness = createLimitsHarness();
  harness.setStorage('planLimitsAll', { free: {} });
  harness.enqueueFetch(packagedDocument);

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.plus['gpt-5-6-sol'].type, 'weekly');
  assert.deepEqual(Array.from(harness.evaluate('__fetchCalls')), [
    'chrome-extension://test/config/plan-limits.json',
  ]);
});

test('invalid packaged data falls back to built-in safe defaults', async () => {
  const harness = createLimitsHarness();
  harness.setStorage('planLimitsAll', { free: {} });
  harness.enqueueFetch({ plans: { free: {} } });

  const limits = await harness.evaluate('self.__GURUM_BG__.getPlanLimitsTemplate()');

  assert.equal(limits.free['gpt-5-5-instant'].displayName, 'GPT-5.5 Instant');
  assert.equal(limits.free['deep-research'].type, 'monthly');
  assert.equal(limits.free['deep-research'].value, 5);
});
