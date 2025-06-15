/**
 * tiktoken 라이브러리의 브라우저 호환 래퍼
 * js-tiktoken npm 패키지를 사용하여 OpenAI 토큰화 정확히 구현
 */

import { encodingForModel, getEncoding } from 'js-tiktoken';

// 모델별 최대 토큰 한도
const MODEL_TOKEN_LIMITS = {
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000
};

/**
 * OpenAI 모델에 맞는 토큰화 객체 반환
 * @param {string} model - OpenAI 모델명 (예: gpt-4, gpt-3.5-turbo)
 * @returns {object} 토큰화 객체
 */
function getEncoder(model) {
  try {
    return encodingForModel(model);
  } catch (e) {
    console.warn(`모델 ${model}에 대한 인코더를 찾을 수 없습니다. cl100k_base를 사용합니다.`, e);
    return getEncoding('cl100k_base');
  }
}

/**
 * 텍스트의 토큰 수 계산
 * @param {string} text - 토큰화할 텍스트
 * @param {string} model - OpenAI 모델명 (예: gpt-4, gpt-3.5-turbo)
 * @returns {number} 토큰 수
 */
function countTokens(text, model = 'gpt-4o') {
  if (!text) return 0;
  
  try {
    const enc = getEncoder(model);
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (e) {
    console.error('토큰화 오류:', e);
    // 오류 시 근사치 계산으로 폴백
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
  if (ratio >= 0.8) return 'warning';   // 80% 이상
  if (ratio >= 0.6) return 'caution';   // 60% 이상
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
    remaining: limit - tokens
  };
}

// 모듈 내보내기
export default {
  countTokens,
  getEncoder,
  getModelLimit,
  getUsageRatio,
  getContextStatus,
  formatTokenInfo
};
