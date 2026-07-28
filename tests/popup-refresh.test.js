/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');

const { extractFunction, readProjectFile } = require('./helpers/source');

const popupSource = readProjectFile('popup.js');

test('render requests arriving mid-render are coalesced into a follow-up pass', () => {
  const source = extractFunction(popupSource, 'renderUsage');

  assert.match(source, /if\s*\(\s*renderUsagePromise\s*\)/);
  assert.match(source, /renderUsageRequested\s*=\s*true/);
  assert.match(
    source,
    /do\s*\{[\s\S]*await\s+renderUsageInternal\(\)[\s\S]*\}\s*while\s*\(\s*renderUsageRequested\s*\)/,
  );
  assert.match(source, /\.finally\(\(\)\s*=>\s*\{[\s\S]*renderUsagePromise\s*=\s*null/);
});

test('periodic usage refresh cannot overlap and preserves a queued deep-research sync', () => {
  const source = extractFunction(popupSource, 'refreshUsage');

  assert.match(source, /if\s*\(\s*syncDeepResearch\s*\)\s*deepResearchSyncRequested\s*=\s*true/);
  assert.match(source, /if\s*\(\s*refreshUsagePromise\s*\)\s*return\s+refreshUsagePromise/);
  assert.match(
    source,
    /do\s*\{[\s\S]*await\s+updateDeepResearchFromContent\(\)[\s\S]*await\s+renderUsage\(\)[\s\S]*\}\s*while\s*\(\s*deepResearchSyncRequested\s*\)/,
  );
  assert.match(source, /\.finally\(\(\)\s*=>\s*\{[\s\S]*refreshUsagePromise\s*=\s*null/);
  assert.match(
    popupSource,
    /setInterval\(\(\)\s*=>\s*refreshUsage\(\{\s*syncDeepResearch:\s*true\s*\}\),\s*60\s*\*\s*1000\)/,
  );
});
