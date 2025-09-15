/**
 * tiktoken 브라우저 래퍼 (2-분할 로드)
 * - 가벼운 core(lite) + 무거운 rank 데이터를 분할하여 동적 로드
 */

import { Tiktoken, getEncodingNameForModel } from 'js-tiktoken/lite';

// 모델별 최대 토큰 한도
const MODEL_TOKEN_LIMITS = {
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  // 신규 gpt-5 계열 (보수적 기본치: 128K)
  'gpt-5': 128000,
  'gpt-5-thinking': 128000,
  'gpt-5-pro': 128000,
};

/**
 * OpenAI 모델에 맞는 토큰화 객체 반환
 * @param {string} model - OpenAI 모델명 (예: gpt-4, gpt-3.5-turbo)
 * @returns {object} 토큰화 객체
 */
const rankModules = {};
const importers = {
  cl100k_base: () =>
    import(
      /* webpackChunkName: "tiktoken-ranks" */
      /* webpackMode: "lazy-once" */
      'js-tiktoken/ranks/cl100k_base'
    ),
  o200k_base: () =>
    import(
      /* webpackChunkName: "tiktoken-ranks" */
      /* webpackMode: "lazy-once" */
      'js-tiktoken/ranks/o200k_base'
    ),
};

async function importRank(name) {
  if (rankModules[name]) return rankModules[name];
  const importer = importers[name] || importers.cl100k_base;
  const mod = await importer();
  rankModules[name] = mod.default;
  return rankModules[name];
}

async function getEncoder(model) {
  const encodingName = (() => {
    try {
      return getEncodingNameForModel(model);
    } catch {
      return 'cl100k_base';
    }
  })();
  const table = await importRank(encodingName);
  return new Tiktoken(table, {});
}

/**
 * 텍스트의 토큰 수 계산
 * @param {string} text - 토큰화할 텍스트
 * @param {string} model - OpenAI 모델명 (예: gpt-4, gpt-3.5-turbo)
 * @returns {number} 토큰 수
 */
async function countTokensAsync(text, model = 'gpt-4o') {
  if (!text) return 0;
  try {
    const enc = await getEncoder(model);
    return enc.encode(text).length;
  } catch (e) {
    console.error('토큰화 오류:', e);
    return estimateTokens(text);
  }
}

// 기존 동기 API 호환을 위한 래퍼(최초 호출 시 블로킹될 수 있음)
function countTokens(text, model = 'gpt-4o') {
  try {
    const encodingName = (() => {
      try {
        return getEncodingNameForModel(model);
      } catch {
        return 'cl100k_base';
      }
    })();

    // 필요한 인코딩이 아직 로드되지 않았다면 백그라운드에서 로드 시도
    if (!rankModules[encodingName]) {
      importRank(encodingName).catch(() => {});
    }
    // cl100k_base는 많은 모델이 공유하므로 기본적으로 프리로드
    if (!rankModules.cl100k_base && encodingName !== 'cl100k_base') {
      importRank('cl100k_base').catch(() => {});
    }

    const table = rankModules[encodingName];
    if (!table) {
      // 인코딩 테이블이 아직 준비되지 않으면 근사치 반환
      return estimateTokens(text);
    }

    const enc = new Tiktoken(table, {});
    return enc.encode(text).length;
  } catch (e) {
    console.error('토큰화 오류:', e);
    return estimateTokens(text);
  }
}

/**
 * 근사치 토큰 계산 (폴백)
 * @param {string} text - 토큰화할 텍스트
 * @returns {number} 토큰 수 근사치
 */
function estimateTokens(text) {
  if (!text) return 0;

  // 영어: ~4자/토큰, 한글: ~2자/토큰 근사치 계산
  const englishChars = (text.match(/[a-zA-Z\s]/g) || []).length;
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - englishChars - koreanChars;

  return Math.ceil(englishChars / 4 + koreanChars / 2 + otherChars / 3);
}

/**
 * 모델별 토큰 한도 반환
 * @param {string} model - OpenAI 모델명
 * @returns {number} 최대 토큰 한도
 */
function getModelLimit(model) {
  return MODEL_TOKEN_LIMITS[model] || 4096; // 기본값 4096
}

/**
 * 토큰 사용률 계산
 * @param {number} tokens - 현재 토큰 수
 * @param {string} model - 모델명
 * @returns {number} 0과 1 사이의 사용률
 */
function getUsageRatio(tokens, model) {
  const limit = getModelLimit(model);
  return Math.min(tokens / limit, 1);
}

/**
 * 컨텍스트 상태 결정
 * @param {number} tokens - 토큰 수
 * @param {string} model - 모델명
 * @returns {string} 상태 ('normal', 'caution', 'warning', 'critical')
 */
function getContextStatus(tokens, model) {
  const ratio = getUsageRatio(tokens, model);

  if (ratio >= 0.95) return 'critical'; // 95% 이상
  if (ratio >= 0.8) return 'warning'; // 80% 이상
  if (ratio >= 0.6) return 'caution'; // 60% 이상
  return 'normal';
}

/**
 * 토큰 정보 객체 형식화
 * @param {number} tokens - 토큰 수
 * @param {string} model - 모델명
 * @returns {object} 포맷된 토큰 정보
 */
function formatTokenInfo(tokens, model) {
  const limit = getModelLimit(model);
  const ratio = getUsageRatio(tokens, model);
  const status = getContextStatus(tokens, model);

  return {
    tokens,
    limit,
    ratio: Math.round(ratio * 100),
    status,
    remaining: limit - tokens,
  };
}

// 모듈 내보내기
export default {
  countTokens,
  countTokensAsync,
  getEncoder,
  getModelLimit,
  getUsageRatio,
  getContextStatus,
  formatTokenInfo,
};
