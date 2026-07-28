// token-calculator.js
// 웹페이지 컨텍스트에서 토큰 계산을 위한 스크립트

// 최적화 설정
const CONFIG = {
  // 토큰 계산 디바운스 시간 (ms)
  DEBOUNCE_DELAY: 300,
  // 토큰 근사치 계산 비율 (글자 수 대비)
  FALLBACK_RATIO: 0.25,
  // 토큰 측정 캐시 유효 시간 (ms)
  CACHE_TTL: 30000, // 30초
  MAX_TEXT_LENGTH: 5_000_000,
  MAX_MODEL_LENGTH: 128,
};
const PAGE_BRIDGE_CHANNEL = 'chatgpt-gurum-tool';
const PAGE_BRIDGE_VERSION = 1;
const REQUEST_ID_MAX_LENGTH = 128;

// 토큰 측정 결과 캐싱
const tokenCache = {
  data: {},
  // 캐시에 저장
  set: function (text, model, result) {
    const key = this._getKey(text, model);
    this.data[key] = {
      result: result,
      timestamp: Date.now(),
    };
  },
  // 캐시에서 조회
  get: function (text, model) {
    const key = this._getKey(text, model);
    const cached = this.data[key];
    if (!cached) return null;

    // 캐시 유효시간 확인
    if (Date.now() - cached.timestamp > CONFIG.CACHE_TTL) {
      delete this.data[key];
      return null;
    }

    return cached.result;
  },
  // 캐시 키 생성
  _getKey: function (text, model) {
    // 텍스트 길이가 100자 이상인 경우 해시 사용
    if (text.length > 100) {
      // 간단한 해시 함수로 텍스트 식별자 생성
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash = hash & hash;
      }
      return `${model}_${text.length}_${hash}`;
    }
    return `${model}_${text}`;
  },
};

// 요청별 타이머로 동시 호출 간 응답 취소를 방지
const pendingTimers = new Map();

function createPageBridgeMessage(type, payload = {}) {
  return {
    channel: PAGE_BRIDGE_CHANNEL,
    version: PAGE_BRIDGE_VERSION,
    type,
    ...payload,
  };
}

function isPageBridgeMessage(data, type) {
  return (
    data !== null &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    data.channel === PAGE_BRIDGE_CHANNEL &&
    data.version === PAGE_BRIDGE_VERSION &&
    data.type === type
  );
}

function isValidRequest(data) {
  return (
    typeof data.text === 'string' &&
    data.text.length <= CONFIG.MAX_TEXT_LENGTH &&
    typeof data.model === 'string' &&
    data.model.length > 0 &&
    data.model.length <= CONFIG.MAX_MODEL_LENGTH &&
    typeof data.requestId === 'string' &&
    data.requestId.length > 0 &&
    data.requestId.length <= REQUEST_ID_MAX_LENGTH
  );
}

function scheduleCalculation(requestId, callback) {
  const existing = pendingTimers.get(requestId);
  if (existing) clearTimeout(existing);
  const timerId = setTimeout(() => {
    pendingTimers.delete(requestId);
    callback();
  }, CONFIG.DEBOUNCE_DELAY);
  pendingTimers.set(requestId, timerId);
}

/**
 * 토큰 수 계산 공통 함수
 * @param {string} text - 토큰화할 텍스트
 * @param {string} model - OpenAI 모델명
 * @returns {number} 토큰 수
 */
function getTokenCount(text, model) {
  // 캐시 확인
  const cached = tokenCache.get(text, model);
  if (cached !== null) {
    // 토큰 캐시 사용
    return cached;
  }

  try {
    if (window.tiktoken && typeof window.tiktoken.countTokens === 'function') {
      const tokens = window.tiktoken.countTokens(text, model);
      // 결과 캐싱
      tokenCache.set(text, model, tokens);
      return tokens;
    }
  } catch (err) {
    console.error('❌ 토큰 계산 오류:', err);
  }

  // 근사치 계산 (fallback)
  return Math.ceil(text.length * CONFIG.FALLBACK_RATIO);
}

/**
 * 텍스트의 토큰 수 계산 함수 (응답 메시지 포함)
 * @param {string} text - 토큰화할 텍스트
 * @param {string} model - OpenAI 모델명
 * @param {string} requestId - 요청 식별자
 */
function calculateTokenCount(text, model, requestId) {
  scheduleCalculation(requestId, () => {
    const tokens = getTokenCount(text, model);
    const success = window.tiktoken && typeof window.tiktoken.countTokens === 'function';

    window.postMessage(
      createPageBridgeMessage('CHATGPT_TOOL_TOKEN_COUNT_RESPONSE', {
        requestId: requestId,
        tokens: tokens,
        chars: text.length,
        success: success,
        error: !success ? 'tiktoken 함수를 찾을 수 없음' : null,
      }),
      '*',
    );
  });
}

/**
 * 컨텍스트 크기 계산 함수
 * @param {string} text - 토큰화할 텍스트
 * @param {string} model - OpenAI 모델명
 */
function calculateContextSize(text, model, requestId) {
  scheduleCalculation(requestId, () => {
    const tokens = getTokenCount(text, model);
    const success = window.tiktoken && typeof window.tiktoken.countTokens === 'function';

    window.postMessage(
      createPageBridgeMessage('CHATGPT_TOOL_CONTEXT_TOKENS', {
        requestId: requestId,
        tokens: tokens,
        chars: text.length,
        success: success,
        error: !success ? 'tiktoken 함수를 찾을 수 없음' : null,
      }),
      '*',
    );
  });
}

// 메시지 수신 리스너
window.addEventListener('message', function (event) {
  // 메시지가 현재 창에서 왔는지 확인
  if (event.source !== window) return;

  const data = event.data;

  // 토큰 계산 요청
  if (isPageBridgeMessage(data, 'CALCULATE_TOKEN_COUNT') && isValidRequest(data)) {
    calculateTokenCount(data.text, data.model, data.requestId);
  }

  // 컨텍스트 크기 계산 요청
  if (isPageBridgeMessage(data, 'CALCULATE_CONTEXT_SIZE') && isValidRequest(data)) {
    calculateContextSize(data.text, data.model, data.requestId);
  }
});

// 토큰 계산 라이브러리가 로드되었음을 알림
window.postMessage(createPageBridgeMessage('TOKEN_CALCULATOR_LOADED'), '*');
