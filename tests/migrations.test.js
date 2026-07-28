/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const { readJson, readProjectFile } = require('./helpers/source');

test('legacy policy migration preserves the canonical packaged plan', async () => {
  const packaged = readJson('config/plan-limits.json');
  const storage = {
    usageCounts: {},
    limits: {
      'gpt-5': { type: 'threeHour', value: 160 },
      'gpt-5-thinking': { type: 'weekly', value: 3000 },
    },
    currentPlan: 'plus',
    planLimitsAll: packaged.plans,
  };
  const context = vm.createContext({
    console: { warn() {} },
    self: { __GURUM_BG__: {} },
    chrome: {
      storage: {
        local: {
          async get() {
            return structuredClone(storage);
          },
          async set(values) {
            Object.assign(storage, structuredClone(values));
          },
        },
      },
    },
  });

  vm.runInContext(readProjectFile('background/migrations.js'), context, {
    filename: 'background/migrations.js',
  });
  await context.self.__GURUM_BG__.migratePolicy2025_08('plus');

  assert.deepEqual(Object.keys(storage.limits).sort(), Object.keys(packaged.plans.plus).sort());
  assert.equal(storage.limits['gpt-5'], undefined);
  assert.equal(storage.limits['gpt-5-thinking'], undefined);
  assert.equal(storage.limits['gpt-5-5-instant'].displayName, 'GPT-5.5 Instant');
  assert.deepEqual(storage.limits['gpt-5-5-instant'].detect, [
    'gpt-5.5',
    'gpt-5.5-instant',
    'gpt-5-5',
    'gpt-5-5-instant',
  ]);
});
