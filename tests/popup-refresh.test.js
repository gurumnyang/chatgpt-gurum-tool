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

test('usage refresh reads storage only and does not poll page DOM for Deep Research', () => {
  const source = extractFunction(popupSource, 'refreshUsage');

  assert.match(source, /if\s*\(\s*refreshUsagePromise\s*\)\s*return\s+refreshUsagePromise/);
  assert.match(source, /renderUsage\(\)\.finally/);
  assert.match(source, /\.finally\(\(\)\s*=>\s*\{[\s\S]*refreshUsagePromise\s*=\s*null/);
  assert.doesNotMatch(popupSource, /checkDeepResearchRemaining/);
  assert.doesNotMatch(popupSource, /setInterval\([^)]*refreshUsage/);
  assert.match(
    popupSource,
    /chrome\.storage\.onChanged\.addListener\([\s\S]*deepResearch[\s\S]*refreshUsage\(\)/,
  );
});

test('dynamic limits render the count without a fake total or progress bar', () => {
  assert.match(
    popupSource,
    /if\s*\(\s*type\s*===\s*['"]dynamic['"]\s*\)[\s\S]*limit_label_dynamic[\s\S]*return/,
  );
  assert.match(popupSource, /Number\.isFinite\(drTotalValue\)/);
  assert.doesNotMatch(popupSource, /getNextMonthlyResetTimestamp/);
});

test('feature quota cards omit data-source and include Image Generation remaining', () => {
  const popupHtml = readProjectFile('popup.html');

  assert.doesNotMatch(popupHtml, /data-source/);
  assert.doesNotMatch(popupSource, /chatgpt_api_source|data-source/);
  assert.match(popupHtml, /id="imageGenerationCount"/);
  assert.match(popupSource, /imageGeneration/);
});

test('context limits use the published numeric values without encoding variable limits', () => {
  const contentSource = readProjectFile('content.js');

  assert.match(contentSource, /free:\s*27000/);
  assert.match(contentSource, /go:\s*54000/);
  assert.match(contentSource, /plus:\s*54000/);
  assert.match(contentSource, /pro:\s*128000/);
  assert.match(popupSource, /free:\s*256000/);
  assert.match(popupSource, /go:\s*256000/);
  assert.match(popupSource, /plus:\s*256000/);
  assert.match(popupSource, /team:\s*256000/);
  assert.match(popupSource, /pro:\s*400000/);
  assert.doesNotMatch(popupSource, /추론 \(196K\)/);
});

test('popup ranks current GPT model families in the requested order', () => {
  const ranks = [
    ['gpt-5-5-instant', 0],
    ['gpt-5-6-sol', 10],
    ['gpt-5-6-pro', 11],
    ['gpt-5-3-instant', 20],
    ['gpt-5-5-thinking', 30],
    ['gpt-5-5-pro', 31],
  ];

  for (const [model, rank] of ranks) {
    assert.match(popupSource, new RegExp(`['"]${model}['"]:\\s*${rank}`));
  }
});

test('plan picker exposes Go and labels the internal team slug as Business', () => {
  const popupHtml = readProjectFile('popup.html');
  assert.match(popupHtml, /<option value="go">Go<\/option>/);
  assert.match(popupHtml, /<option value="team">Business<\/option>/);
});
