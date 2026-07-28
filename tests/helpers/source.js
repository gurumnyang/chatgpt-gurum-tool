/* eslint-env node */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`Function not found: ${name}`);

  const openParenthesis = source.indexOf('(', start);
  let parenthesisDepth = 0;
  let openBrace = -1;
  for (let index = openParenthesis; index < source.length; index += 1) {
    if (source[index] === '(') {
      parenthesisDepth += 1;
    } else if (source[index] === ')') {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        openBrace = source.indexOf('{', index);
        break;
      }
    }
  }
  if (openBrace === -1) throw new Error(`Function body not found: ${name}`);

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`Unterminated function: ${name}`);
}

module.exports = { extractFunction, readJson, readProjectFile, root };
