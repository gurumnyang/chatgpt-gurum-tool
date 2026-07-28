// content script 로직: ChatGPT 웹 페이지 DOM 접근 및 조작 담당
console.log('Content script 로드됨. DOM 조작 및 메시지 처리 준비 완료.');

const SCROLL_CONTROLS_ID = 'gurum-scroll-controls';
const SCROLL_CONTROLS_STYLE_ID = 'gurum-scroll-controls-style';
const PAGE_BRIDGE_CHANNEL = 'chatgpt-gurum-tool';
const PAGE_BRIDGE_VERSION = 1;
const PAGE_BRIDGE_REQUEST_TIMEOUT = 2000;
const SNAPSHOT_REQUEST_TIMEOUT = 10_000;
const PAGE_BRIDGE_MAX_TEXT_LENGTH = 5_000_000;
const PAGE_BRIDGE_MAX_TOKEN_COUNT = 1_000_000_000;
const PAGE_BRIDGE_MAX_MESSAGES = 50_000;
const hoverToolbarModule = window.GurumHoverToolbar || {};
const initializeHoverToolbar =
  typeof hoverToolbarModule.initializeHoverToolbar === 'function'
    ? hoverToolbarModule.initializeHoverToolbar
    : () => {};
const applyHoverToolbarTheme =
  typeof hoverToolbarModule.applyHoverToolbarTheme === 'function'
    ? hoverToolbarModule.applyHoverToolbarTheme
    : () => {};
const HOVER_THEME_STORAGE_KEY =
  typeof hoverToolbarModule.HOVER_THEME_STORAGE_KEY === 'string'
    ? hoverToolbarModule.HOVER_THEME_STORAGE_KEY
    : 'popupTheme';
const setHoverToolbarEnabled =
  typeof hoverToolbarModule.setHoverToolbarEnabled === 'function'
    ? hoverToolbarModule.setHoverToolbarEnabled
    : () => {};

function createPageBridgeMessage(type, payload = {}) {
  return {
    channel: PAGE_BRIDGE_CHANNEL,
    version: PAGE_BRIDGE_VERSION,
    type,
    ...payload,
  };
}

// 채널/버전은 메시지 충돌 방지용 계약이며, main world에서 위조 불가능한 보안 경계는 아니다.
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

function createPageBridgeRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function isValidRequestId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isValidTokenResponse(data, type, requestId) {
  return (
    isPageBridgeMessage(data, type) &&
    isValidRequestId(data.requestId) &&
    data.requestId === requestId &&
    Number.isSafeInteger(data.tokens) &&
    data.tokens >= 0 &&
    data.tokens <= PAGE_BRIDGE_MAX_TOKEN_COUNT &&
    Number.isSafeInteger(data.chars) &&
    data.chars >= 0 &&
    data.chars <= PAGE_BRIDGE_MAX_TEXT_LENGTH &&
    typeof data.success === 'boolean'
  );
}

function sanitizeDeepResearchInfo(info) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
  if (info.feature_name !== 'deep_research') return null;

  const remaining = Number(info.remaining);
  if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > 100_000) return null;

  const resetAfter =
    typeof info.reset_after === 'string' && info.reset_after.length <= 128
      ? info.reset_after
      : typeof info.reset_after === 'number' && Number.isFinite(info.reset_after)
        ? info.reset_after
        : null;
  const sanitized = {
    feature_name: 'deep_research',
    remaining,
  };
  if (resetAfter === null) return sanitized;

  let resetMs =
    typeof resetAfter === 'number' && resetAfter < 1e11 ? resetAfter * 1000 : resetAfter;
  resetMs = new Date(resetMs).getTime();
  const minResetMs = Date.UTC(2020, 0, 1);
  const maxResetMs = Date.UTC(2100, 0, 1);
  if (!Number.isFinite(resetMs) || resetMs < minResetMs || resetMs > maxResetMs) return null;

  sanitized.reset_after = new Date(resetMs).toISOString();
  return sanitized;
}

function sanitizeImageGenerationInfo(info) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
  if (!['image_gen', 'image_generation'].includes(info.feature_name)) return null;

  const remaining = Number(info.remaining);
  if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > 100_000) return null;

  const resetAfter =
    typeof info.reset_after === 'string' && info.reset_after.length <= 128
      ? info.reset_after
      : typeof info.reset_after === 'number' && Number.isFinite(info.reset_after)
        ? info.reset_after
        : null;
  const sanitized = {
    feature_name: 'image_gen',
    remaining,
  };
  if (resetAfter === null) return sanitized;

  let resetMs =
    typeof resetAfter === 'number' && resetAfter < 1e11 ? resetAfter * 1000 : resetAfter;
  resetMs = new Date(resetMs).getTime();
  const minResetMs = Date.UTC(2020, 0, 1);
  const maxResetMs = Date.UTC(2100, 0, 1);
  if (!Number.isFinite(resetMs) || resetMs < minResetMs || resetMs > maxResetMs) return null;

  sanitized.reset_after = new Date(resetMs).toISOString();
  return sanitized;
}

function getCurrentConversationId() {
  const match = window.location.pathname.match(/\/c\/([^/]+)/);
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]);
    return value.length > 0 && value.length <= 256 ? value : null;
  } catch {
    return null;
  }
}

function onDocumentReady(callback) {
  if (typeof callback !== 'function') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function injectScrollControlsStyles() {
  if (document.getElementById(SCROLL_CONTROLS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLL_CONTROLS_STYLE_ID;
  style.textContent = `
    #${SCROLL_CONTROLS_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9999;
    }

    #${SCROLL_CONTROLS_ID} button {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: none;
      background: rgba(52, 58, 64, 0.9);
      color: #f8f9fa;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
      opacity: 0.85;
    }

    #${SCROLL_CONTROLS_ID} button:hover {
      opacity: 1;
      transform: translateY(-2px);
    }

    #${SCROLL_CONTROLS_ID} button:active {
      transform: translateY(0);
    }

    #${SCROLL_CONTROLS_ID} button svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    #${SCROLL_CONTROLS_ID}[data-hidden='true'] {
      display: none;
    }
  `;
  document.documentElement.appendChild(style);
}

function createScrollControls() {
  if (document.getElementById(SCROLL_CONTROLS_ID)) return;
  injectScrollControlsStyles();

  const container = document.createElement('div');
  container.id = SCROLL_CONTROLS_ID;

  const upButton = document.createElement('button');
  upButton.setAttribute('aria-label', '맨 위로 이동');
  upButton.innerHTML = `
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.33468 3.33333C9.33468 2.96617 9.6326 2.66847 9.99972 2.66829C10.367 2.66829 10.6648 2.96606 10.6648 3.33333V15.0609L15.363 10.3626L15.4675 10.2777C15.7255 10.1074 16.0762 10.1357 16.3034 10.3626C16.5631 10.6223 16.5631 11.0443 16.3034 11.304L10.4704 17.137C10.2108 17.3967 9.7897 17.3966 9.52999 17.137L3.69601 11.304L3.61105 11.1995C3.44054 10.9414 3.46874 10.5899 3.69601 10.3626C3.92328 10.1354 4.27479 10.1072 4.53292 10.2777L4.63741 10.3626L9.33468 15.0599V3.33333Z"></path>
    </svg>
  `;
  upButton.querySelector('svg').style.transform = 'rotate(180deg)';
  upButton.addEventListener('click', () => {
    const target = getScrollTarget();
    try {
      target.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // 일부 요소 (예: documentElement)에서 smooth 지원이 제한될 경우 폴백
      target.scrollTop = 0;
    }
  });

  const downButton = document.createElement('button');
  downButton.setAttribute('aria-label', '맨 아래로 이동');
  downButton.innerHTML = `
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.33468 3.33333C9.33468 2.96617 9.6326 2.66847 9.99972 2.66829C10.367 2.66829 10.6648 2.96606 10.6648 3.33333V15.0609L15.363 10.3626L15.4675 10.2777C15.7255 10.1074 16.0762 10.1357 16.3034 10.3626C16.5631 10.6223 16.5631 11.0443 16.3034 11.304L10.4704 17.137C10.2108 17.3967 9.7897 17.3966 9.52999 17.137L3.69601 11.304L3.61105 11.1995C3.44054 10.9414 3.46874 10.5899 3.69601 10.3626C3.92328 10.1354 4.27479 10.1072 4.53292 10.2777L4.63741 10.3626L9.33468 15.0599V3.33333Z"></path>
    </svg>
  `;
  downButton.addEventListener('click', () => {
    const target = getScrollTarget();
    const maxScroll = target.scrollHeight; // 대상 요소의 전체 높이
    try {
      target.scrollTo({ top: maxScroll, behavior: 'smooth' });
    } catch {
      target.scrollTop = maxScroll;
    }
  });

  container.append(upButton, downButton);
  document.body.appendChild(container);
}

// ChatGPT가 명시한 대화 스크롤 루트를 우선해 사이드바의 overflow 컨테이너가
// 선택되지 않게 한다. 이전 DOM을 위한 class/document 폴백은 그대로 유지한다.
function getScrollTarget() {
  const scrollRoot = document.querySelector('[data-scroll-root]');
  if (scrollRoot) return scrollRoot;

  const candidates = Array.from(document.querySelectorAll('div[class*="overflow-y-auto"]') || []);
  const fullMatch = candidates.find((el) => {
    const cls = el.className || '';
    return (
      cls.includes('overflow-y-auto') &&
      cls.includes('flex') &&
      cls.includes('flex-col') &&
      (cls.includes('h-full') || cls.includes('h-screen'))
    );
  });
  if (fullMatch) return fullMatch;
  if (candidates.length) return candidates[0];
  return document.scrollingElement || document.documentElement || document.body;
}

// tiktoken 라이브러리 로드 (페이지에 주입)
function injectTiktokenLibrary() {
  const tiktokenBundleScript = document.createElement('script');
  tiktokenBundleScript.src = chrome.runtime.getURL('dist/tiktoken.bundle.js');
  tiktokenBundleScript.onload = function () {
    console.log('✅ tiktoken 번들 라이브러리 로드 완료');
    // tiktoken 로드 후 토큰 계산기 로드
    const tokenCalculatorScript = document.createElement('script');
    tokenCalculatorScript.src = chrome.runtime.getURL('token-calculator.js');
    tokenCalculatorScript.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(tokenCalculatorScript);
    this.remove();
  };
  tiktokenBundleScript.onerror = function (error) {
    console.error('❌ tiktoken 번들 라이브러리 로드 실패:', error);
    // 실패해도 토큰 계산기 로드는 진행 (근사치 사용)
    const tokenCalculatorScript = document.createElement('script');
    tokenCalculatorScript.src = chrome.runtime.getURL('token-calculator.js');
    tokenCalculatorScript.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(tokenCalculatorScript);
  };
  (document.head || document.documentElement).appendChild(tiktokenBundleScript);
}

// API 요청 가로채기를 위한 스크립트 주입 함수
function injectAPIHooks() {
  const parent = document.head || document.documentElement;
  const injectFetchHook = () => {
    const fetchHook = document.createElement('script');
    fetchHook.src = chrome.runtime.getURL('fetch-hook.js');
    fetchHook.async = false;
    fetchHook.onload = function () {
      console.log('✅ Fetch 후킹 스크립트 로드 완료');
      this.remove();
    };
    fetchHook.onerror = function (error) {
      console.error('❌ Fetch 후킹 스크립트 로드 실패:', error);
    };
    parent.appendChild(fetchHook);
  };

  const snapshotHelper = document.createElement('script');
  snapshotHelper.src = chrome.runtime.getURL('conversation-snapshot.js');
  snapshotHelper.async = false;
  snapshotHelper.onload = function () {
    this.remove();
    injectFetchHook();
  };
  snapshotHelper.onerror = function () {
    this.remove();
    // 스냅샷 헬퍼가 없어도 기존 API 기능은 계속 동작한다.
    injectFetchHook();
  };
  parent.appendChild(snapshotHelper);
}

// 메시지 타임스탬프 표시 스크립트 주입 및 토글
let tsScriptAppended = false; // 스크립트 태그가 추가되었는지 여부
let tsLoaded = false; // 인젝터가 실제 로드되었는지 여부
let desiredTsEnabled = null; // 사용자가 의도한 최종 상태 (true/false)
const tsPendingCallbacks = []; // 로드 후 실행할 콜백 큐
let currentTimestampFormat = 'standard';

function validateTimestampFormat(value) {
  const allowed = ['standard', 'compact', 'relative'];
  return allowed.includes(value) ? value : 'standard';
}

function dispatchTimestampFormat() {
  const format = currentTimestampFormat;
  const send = () => {
    window.postMessage(createPageBridgeMessage('GURUM_TS_SET_FORMAT', { format }), '*');
  };
  if (tsLoaded) {
    send();
  } else {
    tsPendingCallbacks.push(send);
  }
}

function injectTimestampInjector(onReady) {
  try {
    if (tsLoaded) {
      if (typeof onReady === 'function') {
        try {
          onReady();
        } catch (_) {}
      }
      return;
    }
    if (tsScriptAppended) {
      if (typeof onReady === 'function') tsPendingCallbacks.push(onReady);
      return;
    }
    const s = document.createElement('script');
    s.id = 'gurum-timestamp-injector';
    s.src = chrome.runtime.getURL('timestamp-injector.js');
    s.onload = function () {
      tsLoaded = true;
      try {
        if (typeof onReady === 'function') onReady();
      } catch (_) {}
      // 대기 중인 콜백 처리
      while (tsPendingCallbacks.length) {
        const cb = tsPendingCallbacks.shift();
        try {
          cb && cb();
        } catch (_) {}
      }
      this.remove();
    };
    s.onerror = (e) => {
      console.error('❌ Timestamp injector 로드 실패:', e);
      // 재시도를 가능하게 플래그 복구
      tsScriptAppended = false;
      tsLoaded = false;
    };
    (document.head || document.documentElement).appendChild(s);
    tsScriptAppended = true;
  } catch (e) {
    console.error('🚨 Timestamp injector 주입 중 오류:', e);
  }
}

async function applyTimestampSetting(enabled) {
  try {
    desiredTsEnabled = !!enabled;
    if (enabled) {
      dispatchTimestampFormat();
      injectTimestampInjector(() => {
        // 실제 인젝터 로드가 확인된 시점에서만 ENABLE 전송
        if (desiredTsEnabled) {
          window.postMessage(createPageBridgeMessage('GURUM_TS_ENABLE'), '*');
        }
      });
    } else {
      // 주입되어 있지 않아도 비활성 메시지는 안전
      window.postMessage(createPageBridgeMessage('GURUM_TS_DISABLE'), '*');
    }
  } catch (e) {
    console.warn('타임스탬프 설정 적용 실패:', e);
  }
}

// 확장 프로그램 컨텍스트 유효성 및 재연결 관리
let isExtensionContextValid = true;

// 확장 컨텍스트 유효성 확인 함수
function checkExtensionContext() {
  try {
    // chrome.runtime.id에 접근하여 유효성 확인
    if (chrome.runtime.id) {
      if (!isExtensionContextValid) {
        isExtensionContextValid = true;
      }
      // SPA 전환으로 main 노드가 교체된 경우 observer 대상을 갱신한다.
      observeConversation();
      return true;
    }
  } catch (error) {
    if (isExtensionContextValid) {
      console.warn('⚠️ 확장 프로그램 컨텍스트가 무효화되었습니다:', error);
      isExtensionContextValid = false;
    }
    return false;
  }
  return false;
}

// 주기적으로 확장 컨텍스트 유효성 확인 (5초마다)
setInterval(checkExtensionContext, 5000);

// 안전한 메시지 전송 래퍼 함수
function safeSendMessage(message, callback) {
  if (!checkExtensionContext()) {
    console.warn('🚨 확장 프로그램 컨텍스트가 유효하지 않아 메시지를 전송할 수 없습니다');
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('🚨 메시지 전송 중 오류:', chrome.runtime.lastError.message);
        return;
      }
      if (callback) callback(response);
    });
  } catch (error) {
    console.error('🚨 메시지 전송 실패:', error);
  }
}

// 페이지 로드 시 즉시 후킹 스크립트 주입 - 확장 컨텍스트 유효성 검사 추가
try {
  // chrome.runtime.id에 접근해봄으로써 확장 컨텍스트 유효성 확인
  if (chrome.runtime.id) {
    injectAPIHooks();
    injectTiktokenLibrary();
    // 초기 타임스탬프 설정 및 형식 적용
    chrome.storage.local.get(['showTimestamps', 'timestampFormat'], (data) => {
      currentTimestampFormat = validateTimestampFormat(data.timestampFormat);
      dispatchTimestampFormat();
      applyTimestampSetting(!!data.showTimestamps);
    });
    console.log('✅ 확장 프로그램 컨텍스트 유효, API 후킹 시작');
  } else {
    console.warn('⚠️ 확장 프로그램 컨텍스트가 유효하지 않음');
  }
} catch (error) {
  console.error('🚨 확장 프로그램 컨텍스트 검증 중 오류:', error);
}

// window.postMessage로 전달된 데이터를 background로 전달
window.addEventListener('message', (event) => {
  // iframe 등 다른 window의 메시지를 제외한다.
  if (event.source !== window) return;

  const data = event.data;
  // Deep Research 정보 처리 (fetch 후킹에서 전송)
  if (isPageBridgeMessage(data, 'CHATGPT_TOOL_DEEP_RESEARCH_INFO')) {
    const info = sanitizeDeepResearchInfo(data.info);
    if (!info) return;
    console.log('🔍 Deep Research 정보 받음, background로 전달:', info);
    safeSendMessage({
      type: 'deep_research_info',
      info,
    });
  }
  if (isPageBridgeMessage(data, 'CHATGPT_TOOL_IMAGE_GENERATION_INFO')) {
    const info = sanitizeImageGenerationInfo(data.info);
    if (!info) return;
    safeSendMessage({
      type: 'image_generation_info',
      info,
    });
  }
  // 참고: 토큰 계산 결과는 이제 calculateContextSize 내에서 직접 처리됨
});

// DOM이 완전히 로드된 후 초기화
onDocumentReady(() => {
  observeConversation();
  initializeHoverToolbar();
  createScrollControls();
});

// 대화 영역 변경사항 관찰 (새 메시지 등을 감지)
// debounce를 위한 변수
let observationTimer = null;
let conversationObserver = null;
let conversationObserverTarget = null;
const OBSERVATION_DEBOUNCE_TIME = 1000; // 1초 디바운스

function observeConversation() {
  const targetNode = document.querySelector('main') || document.body;
  if (!targetNode) return;
  if (conversationObserver && conversationObserverTarget === targetNode) return;
  if (conversationObserver) conversationObserver.disconnect();

  conversationObserver = new MutationObserver((mutations) => {
    // 변경 발생 시 디바운스 처리
    clearTimeout(observationTimer);

    observationTimer = setTimeout(() => {
      let hasMessageChange = false;

      for (const mutation of mutations) {
        // 메시지 추가/수정/삭제 확인
        if (
          mutation.addedNodes.length > 0 ||
          mutation.removedNodes.length > 0 ||
          (mutation.target &&
            mutation.target.className &&
            typeof mutation.target.className === 'string' &&
            (mutation.target.className.includes('message') ||
              mutation.target.className.includes('markdown')))
        ) {
          hasMessageChange = true;
          break;
        }
      }

      if (hasMessageChange) {
        // 대화 변경 시 측정 캐시 초기화
        if (window.CONTEXT_MEASUREMENT) {
          window.CONTEXT_MEASUREMENT.lastMeasureTime = 0;
          window.CONTEXT_MEASUREMENT.lastResult = null;
        }

        // 필요 시 background에 알림
        safeSendMessage({
          type: 'chat_content_changed',
        });
      }
    }, OBSERVATION_DEBOUNCE_TIME);
  });

  conversationObserver.observe(targetNode, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  conversationObserverTarget = targetNode;
}

window.addEventListener(
  'pagehide',
  () => {
    if (conversationObserver) conversationObserver.disconnect();
    conversationObserver = null;
    conversationObserverTarget = null;
    clearTimeout(observationTimer);
    observationTimer = null;
  },
  { once: true },
);

// 메시지 리스너 - 팝업/백그라운드와 통신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === 'applyTimestampSetting') {
      applyTimestampSetting(!!message.enabled);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'applyTimestampFormat') {
      currentTimestampFormat = validateTimestampFormat(message.format);
      dispatchTimestampFormat();
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'setHoverToolbarEnabled') {
      setHoverToolbarEnabled(!!message.enabled);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'exportConversation') {
      requestConversationSnapshot()
        .then((snapshot) => {
          const conversation = snapshot ? snapshot.messages : extractCompleteDomConversation();
          if (!conversation) throw new Error('전체 세션 스냅샷을 가져오지 못했습니다.');
          sendResponse({
            conv: filterConversationRange(conversation, message.startId, message.endId),
            source: snapshot ? 'conversation_api' : 'rendered_dom_fallback',
          });
        })
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }

    if (message.type === 'getContextSize') {
      calculateContextSize()
        .then((size) => {
          sendResponse({ size });
        })
        .catch((error) => {
          console.error('🚨 토큰 계산 중 오류:', error);
          sendResponse({ error: error.message });
        });
      return true; // 비동기 응답을 위해 true 반환
    }

    if (message.type === 'getContextTokens') {
      const model = message.model || 'gpt-4o';
      requestConversationSnapshot()
        .then((snapshot) => {
          const fallbackConversation = snapshot ? null : extractCompleteDomConversation();
          if (!snapshot && !fallbackConversation) {
            throw new Error('전체 세션 스냅샷을 가져오지 못했습니다.');
          }
          const text = snapshot
            ? snapshot.text
            : fallbackConversation.map((item) => item.content).join('');
          return requestPageTokenCount(
            text,
            model,
            'CALCULATE_TOKEN_COUNT',
            'CHATGPT_TOOL_TOKEN_COUNT_RESPONSE',
          );
        })
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }
  } catch (error) {
    console.error('🚨 메시지 처리 중 오류 발생:', error);
    sendResponse({ error: error.message });
  }
  return false;
});

// 스토리지 변경 감지로 타임스탬프 설정 동기화
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (Object.prototype.hasOwnProperty.call(changes, 'showTimestamps')) {
      const nv = changes.showTimestamps.newValue;
      applyTimestampSetting(!!nv);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'timestampFormat')) {
      const nv = validateTimestampFormat(changes.timestampFormat.newValue);
      currentTimestampFormat = nv;
      dispatchTimestampFormat();
    }
    if (Object.prototype.hasOwnProperty.call(changes, HOVER_THEME_STORAGE_KEY)) {
      applyHoverToolbarTheme(changes[HOVER_THEME_STORAGE_KEY].newValue);
    }
  });
} catch {}

function extractConversation(startId, endId) {
  const chatThread = [];
  const seenIds = new Set();
  let capturing = !startId;

  // 태그 이름은 UI 개편 때 바뀔 수 있으므로 test id만 계약으로 사용한다.
  // 일반 turn은 기존 message id를 유지하고, wrapper가 없는 이미지 turn만 turn id로 폴백한다.
  const collected = [];
  document.querySelectorAll("[data-testid^='conversation-turn']").forEach((turn) => {
    const messages = turn.querySelectorAll('div[data-message-author-role][data-message-id]');
    if (messages.length) {
      messages.forEach((message) => collected.push({ element: message, turn, wrapperless: false }));
      return;
    }

    if (turn.getAttribute('data-turn-id') && turn.getAttribute('data-turn')) {
      collected.push({ element: turn, turn, wrapperless: true });
    }
  });

  if (!collected.length) {
    document
      .querySelectorAll('div[data-message-author-role][data-message-id]')
      .forEach((message) => collected.push({ element: message, turn: null }));
  }

  if (!collected.length) return chatThread;

  const CLEAN_ATTRS = [
    'data-start',
    'data-end',
    'data-sourcepos',
    'data-is-last-node',
    'data-is-only-node',
  ];

  const NOISE_SELECTOR = [
    '.chatgpt-time-container',
    'button',
    'h4.sr-only',
    '[data-testid="image-gen-overlay-actions"]',
    '[data-testid="image-gen-overlay-left-actions"]',
    '[data-testid="image-gen-overlay-right-actions"]',
    '[aria-label="응답 작업"]',
    '[role="menu"]',
    '[role="dialog"]',
  ].join(',');

  for (const item of collected) {
    const msgEl = item.element;
    const id =
      msgEl.getAttribute('data-message-id') ||
      (item.turn && item.turn.getAttribute('data-turn-id')) ||
      '';
    const turnId = (item.turn && item.turn.getAttribute('data-turn-id')) || null;
    if (!id || seenIds.has(id)) continue;

    if (!capturing) {
      if (id === startId) capturing = true;
      else continue;
    }

    let sender =
      msgEl.getAttribute('data-message-author-role') ||
      (item.turn && item.turn.getAttribute('data-turn')) ||
      '';
    if (!sender) sender = msgEl.querySelector("svg[data-icon='user']") ? 'user' : 'assistant';

    const cloned = msgEl.cloneNode(true);
    cloned.querySelectorAll(NOISE_SELECTOR).forEach((el) => el.remove());
    CLEAN_ATTRS.forEach((attr) => {
      cloned.querySelectorAll(`[${attr}]`).forEach((node) => node.removeAttribute(attr));
    });

    const contentEl =
      cloned.querySelector('div.whitespace-pre-wrap') ||
      cloned.querySelector('div.markdown') ||
      cloned.querySelector('[data-testid="markdown"]') ||
      cloned.querySelector('[data-message-content]') ||
      cloned.querySelector('[data-conversation-screenshot-content]') ||
      cloned.querySelector('div.text-base') ||
      cloned;

    const imageLines = [];
    const seenImageSources = new Set();
    contentEl.querySelectorAll('img').forEach((image) => {
      const src = (image.currentSrc || image.getAttribute('src') || '').trim();
      const alt = (image.getAttribute('alt') || '').trim();
      const isHidden = image.getAttribute('aria-hidden') === 'true';
      const isSafeSource =
        /^(https?:|blob:)/i.test(src) || src.startsWith('/') || src.startsWith('./');
      const isContentImage = Boolean(alt) || item.wrapperless === true;

      if (isHidden || !isSafeSource || !isContentImage || seenImageSources.has(src)) {
        image.remove();
        return;
      }

      seenImageSources.add(src);
      imageLines.push(`${alt ? `[Image: ${alt}]` : '[Image]'}\n${src}`);
    });

    const html = contentEl.innerHTML.trim().replace(/\n/g, '<br>');
    const textContent = contentEl.textContent.trim();
    const content = [textContent, ...imageLines].filter(Boolean).join('\n\n');
    if (!content) {
      seenIds.add(id);
      if (endId && id === endId) break;
      continue;
    }

    chatThread.push({ id, turnId, sender, html, content });
    seenIds.add(id);

    if (endId && id === endId) break;
  }

  return chatThread;
}

function sanitizeConversationSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    typeof value.text !== 'string' ||
    value.text.length > PAGE_BRIDGE_MAX_TEXT_LENGTH ||
    !Array.isArray(value.messages) ||
    value.messages.length > PAGE_BRIDGE_MAX_MESSAGES ||
    value.messageCount !== value.messages.length ||
    value.chars !== value.text.length
  ) {
    return null;
  }

  const conversationId =
    typeof value.conversationId === 'string' &&
    value.conversationId.length > 0 &&
    value.conversationId.length <= 256
      ? value.conversationId
      : null;
  const messages = [];
  let exportedLength = 0;
  for (const item of value.messages) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const id =
      typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 256 ? item.id : null;
    const nodeId =
      typeof item.nodeId === 'string' && item.nodeId.length > 0 && item.nodeId.length <= 256
        ? item.nodeId
        : id;
    if (
      !id ||
      !nodeId ||
      (item.sender !== 'user' && item.sender !== 'assistant') ||
      typeof item.content !== 'string' ||
      item.content.length > 500_000
    ) {
      return null;
    }
    exportedLength += item.content.length;
    if (exportedLength > PAGE_BRIDGE_MAX_TEXT_LENGTH) return null;
    messages.push({
      id,
      nodeId,
      sender: item.sender,
      content: item.content,
      create_time: Number.isFinite(item.create_time) ? item.create_time : null,
    });
  }

  return {
    conversationId,
    messages,
    text: value.text,
    chars: value.chars,
    messageCount: value.messageCount,
  };
}

function requestConversationSnapshot() {
  return new Promise((resolve) => {
    const requestId = createPageBridgeRequestId();
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', responseListener);
      clearTimeout(timeoutId);
    };
    const finish = (snapshot) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(snapshot);
    };
    const responseListener = (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (
        !isPageBridgeMessage(data, 'GURUM_CONVERSATION_SNAPSHOT_RESPONSE') ||
        data.requestId !== requestId
      ) {
        return;
      }
      finish(sanitizeConversationSnapshot(data.snapshot));
    };
    const timeoutId = setTimeout(() => finish(null), SNAPSHOT_REQUEST_TIMEOUT);
    window.addEventListener('message', responseListener);
    window.postMessage(
      createPageBridgeMessage('GURUM_CONVERSATION_SNAPSHOT_REQUEST', {
        requestId,
        conversationId: getCurrentConversationId(),
        domMessages: extractConversation().map(({ id, turnId, sender, content }) => ({
          id,
          turnId,
          sender,
          content,
        })),
      }),
      '*',
    );
  });
}

function filterConversationRange(messages, startId, endId) {
  if (!startId && !endId) return messages;
  const filtered = [];
  let capturing = !startId;
  for (const message of messages) {
    if (!capturing) {
      if (message.id === startId || message.nodeId === startId) capturing = true;
      else continue;
    }
    filtered.push(message);
    if (endId && (message.id === endId || message.nodeId === endId)) break;
  }
  return filtered;
}

function extractCompleteDomConversation() {
  const conversation = extractConversation();
  const containerIds = new Set();
  document.querySelectorAll('[data-turn-id-container]').forEach((element) => {
    const id = element.getAttribute('data-turn-id-container');
    if (id) containerIds.add(id);
  });
  if (!containerIds.size) return conversation;

  const mountedTurnIds = new Set();
  document.querySelectorAll("[data-testid^='conversation-turn']").forEach((element) => {
    const id =
      element.getAttribute('data-turn-id') || element.getAttribute('data-turn-id-container');
    if (id) mountedTurnIds.add(id);
  });

  // ChatGPT는 root/숨김 노드 하나를 section 없이 유지할 수 있다.
  return containerIds.size <= mountedTurnIds.size + 1 ? conversation : null;
}

// 전역 참조를 위해 window에 할당
window.CONTEXT_MEASUREMENT = {
  lastMeasureTime: 0, // 마지막 측정 시간
  measureInterval: 3000, // 측정 간격 (ms)
  lastResult: null, // 마지막 측정 결과 캐싱
  signatureAtLastMeasure: '', // 마지막 측정 시 대화 서명
  inProgress: false, // 측정 진행 중 여부
  contextLimits: {
    free: 27000, // Free 플랜: 27K 토큰
    go: 54000, // Go 플랜: 54K 토큰
    plus: 54000, // Plus 플랜: 54K 토큰
    team: 32768, // Business 내부 plan slug는 team을 유지
    pro: 128000, // Pro 플랜: 128K 토큰
  },
};

function requestPageTokenCount(text, model, requestType, responseType) {
  return new Promise((resolve) => {
    const requestId = createPageBridgeRequestId();
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', responseListener);
      clearTimeout(timeoutId);
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const responseListener = (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!isValidTokenResponse(data, responseType, requestId)) return;
      finish({
        chars: data.chars,
        tokens: data.tokens,
        success: data.success,
      });
    };
    const timeoutId = setTimeout(
      () =>
        finish({
          chars: text.length,
          tokens: Math.ceil(text.length * 0.25),
          success: false,
        }),
      PAGE_BRIDGE_REQUEST_TIMEOUT,
    );
    window.addEventListener('message', responseListener);
    window.postMessage(
      createPageBridgeMessage(requestType, {
        text,
        model,
        chars: text.length,
        requestId,
      }),
      '*',
    );
  });
}

async function calculateContextSize() {
  const now = Date.now();
  const snapshot = await requestConversationSnapshot();
  const fallbackConversation = snapshot ? [] : extractCompleteDomConversation();
  if (!snapshot && !fallbackConversation) {
    throw new Error('전체 세션 스냅샷을 가져오지 못했습니다.');
  }
  const text = snapshot
    ? snapshot.text
    : fallbackConversation.map((message) => message.content).join('');
  const messageCount = snapshot ? snapshot.messageCount : fallbackConversation.length;
  const conversationId = snapshot ? snapshot.conversationId : getCurrentConversationId();
  const signature = `${conversationId || ''}:${messageCount}:${text.length}`;
  const currentPlan = await new Promise((resolve) => {
    chrome.storage.local.get('currentPlan', (data) => resolve(data.currentPlan || 'free'));
  });

  if (
    now - window.CONTEXT_MEASUREMENT.lastMeasureTime < window.CONTEXT_MEASUREMENT.measureInterval &&
    signature === window.CONTEXT_MEASUREMENT.signatureAtLastMeasure &&
    window.CONTEXT_MEASUREMENT.lastResult
  ) {
    return {
      ...window.CONTEXT_MEASUREMENT.lastResult,
      contextLimit: window.CONTEXT_MEASUREMENT.contextLimits[currentPlan],
    };
  }

  if (window.CONTEXT_MEASUREMENT.inProgress) {
    return (
      window.CONTEXT_MEASUREMENT.lastResult || {
        chars: text.length,
        tokens: 0,
        text: '',
        pending: true,
      }
    );
  }

  window.CONTEXT_MEASUREMENT.inProgress = true;
  try {
    const tokenResult = await requestPageTokenCount(
      text,
      'gpt-4o',
      'CALCULATE_CONTEXT_SIZE',
      'CHATGPT_TOOL_CONTEXT_TOKENS',
    );
    const result = {
      chars: tokenResult.chars,
      tokens: tokenResult.tokens,
      text,
      success: tokenResult.success,
      contextLimit: window.CONTEXT_MEASUREMENT.contextLimits[currentPlan],
      messageCount,
      source: snapshot ? 'conversation_api' : 'rendered_dom_fallback',
    };
    window.CONTEXT_MEASUREMENT.lastResult = result;
    window.CONTEXT_MEASUREMENT.lastMeasureTime = now;
    window.CONTEXT_MEASUREMENT.signatureAtLastMeasure = signature;
    return result;
  } finally {
    window.CONTEXT_MEASUREMENT.inProgress = false;
  }
}
