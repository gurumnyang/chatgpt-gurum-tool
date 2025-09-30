/**
 * gpt-tokenizer(o200k_base) 경량 래퍼
 * - thirdParty/o200k_base.js UMD 번들을 직접 사용
 */

import o200kTokenizer from '../thirdParty/o200k_base.js';

// 모델별 최대 토큰 한도
const MODEL_TOKEN_LIMITS = {
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4.1': 128000,
  'gpt-4.1-mini': 128000,
  'gpt-4.1-nano': 128000,
  o1: 200000,
  'o1-mini': 200000,
  'o1-preview': 200000,
  o3: 200000,
  'o3-mini': 200000,
  'o3-pro': 200000,
  'o4-mini': 200000,
  // 신규 gpt-5 계열 (보수적 기본치: 128K)
  'gpt-5': 400000,
  'gpt-5-thinking': 400000,
  'gpt-5-pro': 400000,
};

async function getEncoder() {
  return o200kTokenizer;
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
    const api = await getEncoder(model);
    return api.countTokens(text);
  } catch (e) {
    console.error('토큰화 오류:', e);
    return estimateTokens(text);
  }
}

// 기존 동기 API 호환을 위한 래퍼(최초 호출 시 근사치 반환 가능)
function countTokens(text, model = 'gpt-4o') {
  if (!text) return 0;
  const api = o200kTokenizer;
  try {
    return api.countTokens(text);
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
const exportedApi = {
  countTokens,
  countTokensAsync,
  getEncoder,
  getModelLimit,
  getUsageRatio,
  getContextStatus,
  formatTokenInfo,
};

export default exportedApi;
