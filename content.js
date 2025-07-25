// content script 로직: ChatGPT 웹 페이지 DOM 접근 및 조작 담당
console.log('Content script 로드됨. DOM 조작 및 메시지 처리 준비 완료.');

// tiktoken 라이브러리 로드 (페이지에 주입)
function injectTiktokenLibrary() {
  // tiktoken 번들만 사용하도록 단순화 (dist 폴더의 번들 사용)
  const tiktokenBundleScript = document.createElement('script');
  tiktokenBundleScript.src = chrome.runtime.getURL('dist/tiktoken.bundle.js');
  tiktokenBundleScript.onload = function() {
    console.log("✅ tiktoken 번들 라이브러리 로드 완료");
    
    // tiktoken 로드 후 토큰 계산기 스크립트 로드
    const tokenCalculatorScript = document.createElement('script');
    tokenCalculatorScript.src = chrome.runtime.getURL('token-calculator.js');
    tokenCalculatorScript.onload = function() {
      console.log("✅ 토큰 계산기 스크립트 로드 완료");
      this.remove();
    };
    tokenCalculatorScript.onerror = function(error) {
      console.error("❌ 토큰 계산기 스크립트 로드 실패:", error);
    };
    (document.head || document.documentElement).appendChild(tokenCalculatorScript);
    
    this.remove();
  };
  
  tiktokenBundleScript.onerror = function(error) {
    console.error("❌ tiktoken 번들 라이브러리 로드 실패:", error);
    // 오류 발생 시 thirdParty 폴더의 번들 시도
    const tiktokenFallbackScript = document.createElement('script');
    tiktokenFallbackScript.src = chrome.runtime.getURL('thirdParty/tiktoken.bundle.js');
    tiktokenFallbackScript.onload = function() {
      console.log("✅ tiktoken 폴백 번들 로드 완료");
      
      // tiktoken 로드 후 토큰 계산기 스크립트 로드
      const tokenCalculatorScript = document.createElement('script');
      tokenCalculatorScript.src = chrome.runtime.getURL('token-calculator.js');
      tokenCalculatorScript.onload = function() {
        console.log("✅ 토큰 계산기 스크립트 로드 완료");
        this.remove();
      };
      (document.head || document.documentElement).appendChild(tokenCalculatorScript);
      
      this.remove();
    };
    (document.head || document.documentElement).appendChild(tiktokenFallbackScript);
  };
  
  (document.head || document.documentElement).appendChild(tiktokenBundleScript);
}

// API 요청 가로채기를 위한 스크립트 주입 함수
function injectAPIHooks() {
  // 1. request-hook.js 주입 (기존 방식)
  const requestHook = document.createElement('script');
  requestHook.src = chrome.runtime.getURL('request-hook.js');
  requestHook.onload = function() {
    console.log("✅ Request 후킹 스크립트 로드 완료");
    this.remove();
  };
  requestHook.onerror = function(error) {
    console.error("❌ Request 후킹 스크립트 로드 실패:", error);
  };
  
  // 2. fetch-hook.js 주입 (추가 방식)
  const fetchHook = document.createElement('script');
  fetchHook.src = chrome.runtime.getURL('fetch-hook.js');
  fetchHook.onload = function() {
    console.log("✅ Fetch 후킹 스크립트 로드 완료");
    this.remove();
  };
  fetchHook.onerror = function(error) {
    console.error("❌ Fetch 후킹 스크립트 로드 실패:", error);
  };
  
  // 페이지에 스크립트 태그 추가
  (document.head || document.documentElement).appendChild(requestHook);
  (document.head || document.documentElement).appendChild(fetchHook);
}

// 확장 프로그램 컨텍스트 유효성 및 재연결 관리
let isExtensionContextValid = true;

// 확장 컨텍스트 유효성 확인 함수
function checkExtensionContext() {
  try {
    // chrome.runtime.id에 접근하여 유효성 확인
    if (chrome.runtime.id) {
      if (!isExtensionContextValid) {
        console.log('🔄 확장 프로그램 컨텍스트가 복원되었습니다. 재연결 시도');
        isExtensionContextValid = true;
        // 여기서 필요한 초기화 작업 수행
        observeConversation();
      }
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
    chrome.runtime.sendMessage(message, response => {
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
    console.log('✅ 확장 프로그램 컨텍스트 유효, API 후킹 시작');
  } else {
    console.warn('⚠️ 확장 프로그램 컨텍스트가 유효하지 않음');
  }
} catch (error) {
  console.error('🚨 확장 프로그램 컨텍스트 검증 중 오류:', error);
}

// window.postMessage로 전달된 데이터를 background로 전달
window.addEventListener('message', event => {
  // 보안 검사: 메시지 출처가 현재 창인지 확인
  if (event.source !== window) return;

  const data = event.data;
    // 1. conversation/init 요청 데이터 처리
  if (data && data.type === 'CHATGPT_TOOL_INIT_REQUEST') {
    console.log('🔄 Conversation/init 요청 데이터 받음, background로 전달:', data);
    safeSendMessage({
      type: 'init_request_captured',
      data: data
    });
  }
  // 2. Deep Research 정보 처리 (fetch 후킹에서 전송)
  if (data && data.type === 'CHATGPT_TOOL_DEEP_RESEARCH_INFO') {
    console.log('🔍 Deep Research 정보 받음, background로 전달:', data.info);
    safeSendMessage({
      type: 'deep_research_info',
      info: data.info
    });
  }
  // 3. 메시지 카운트 처리 (request 후킹에서 전송)
  if (data && data.type === 'CHATGPT_TOOL_MESSAGE_COUNT') {
    console.log('📊 메시지 카운트 정보 받음, background로 전달:', data.model);
    safeSendMessage({
      type: 'messageCount',
      model: data.model,
      timestamp: data.timestamp || Date.now()
    });
  }
  // 참고: 토큰 계산 결과는 이제 calculateContextSize 내에서 직접 처리됨
});

// DOM이 완전히 로드된 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM이 로드되었습니다. ChatGPT 페이지 분석 시작.');
  
  // 페이지 분석 및 필요한 DOM 요소 관찰 등 초기화 작업
  observeConversation();
});

// 대화 영역 변경사항 관찰 (새 메시지 등을 감지)
// debounce를 위한 변수
let observationTimer = null;
const OBSERVATION_DEBOUNCE_TIME = 1000; // 1초 디바운스

function observeConversation() {
  const targetNode = document.querySelector('main') || document.body;
  if (!targetNode) return;
  
  const observer = new MutationObserver(mutations => {
    // 변경 발생 시 디바운스 처리
    clearTimeout(observationTimer);
    
    observationTimer = setTimeout(() => {
      let hasMessageChange = false;
      
      for (const mutation of mutations) {
        // 메시지 추가/수정/삭제 확인
        if (
          mutation.addedNodes.length > 0 || 
          mutation.removedNodes.length > 0 ||
          (mutation.target && mutation.target.className && (
            typeof mutation.target.className === 'string' &&
            (mutation.target.className.includes('message') || 
             mutation.target.className.includes('markdown'))
          ))
        ) {
          hasMessageChange = true;
          break;
        }
      }
      
      if (hasMessageChange) {
        console.log('🔄 대화 내용 변경 감지, 컨텍스트 측정 캐시 무효화');
        // 대화 변경 시 측정 캐시 초기화
        if (window.CONTEXT_MEASUREMENT) {
          window.CONTEXT_MEASUREMENT.lastMeasureTime = 0;
          window.CONTEXT_MEASUREMENT.lastResult = null;
        }
        
        // 필요 시 background에 알림
        safeSendMessage({
          type: 'chat_content_changed'
        });
      }
    }, OBSERVATION_DEBOUNCE_TIME);
  });
  
  observer.observe(targetNode, { 
    childList: true, 
    subtree: true,
    characterData: true
  });
  console.log('✅ 대화 영역 관찰 시작 (디바운스: ' + OBSERVATION_DEBOUNCE_TIME + 'ms)');
}

// 메시지 리스너 - 팝업/백그라운드와 통신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.type === 'exportConversation') {
        const conv = extractConversation(message.startId, message.endId);
        sendResponse({ conv });
        return true;
      }
      
      if (message.type === 'getContextSize') {
        calculateContextSize()
          .then(size => {
            sendResponse({ size });
          })
          .catch(error => {
            console.error('🚨 토큰 계산 중 오류:', error);
            sendResponse({ error: error.message });
          });
        return true; // 비동기 응답을 위해 true 반환
      }
      
      if (message.type === 'getContextTokens') {
        const model = message.model || 'gpt-4o';
        // 대화 내용 가져오기
        const conversation = extractConversation();
        let text = '';
        conversation.forEach(msg => {
          text += msg.content + '\n';
        });
        
        // 고유한 메시지 ID 생성 (여러 요청 구분용)
        const requestId = 'req_' + Date.now();
        
        // 한 번만 실행되는 응답 리스너
        const responseListener = function(event) {
          if (event.source !== window) return;
          const data = event.data;
          
          if (data && data.type === 'CHATGPT_TOOL_TOKEN_COUNT_RESPONSE' && data.requestId === requestId) {
            // 리스너 제거 (메모리 누수 방지)
            window.removeEventListener('message', responseListener);
            
            // 결과 반환
            sendResponse({
              tokens: data.tokens,
              chars: data.chars,
              success: data.success
            });
          }
        };
        
        // 응답 리스너 등록
        window.addEventListener('message', responseListener);
        
        // 토큰 계산 요청 메시지 전송
        window.postMessage({
          type: 'CALCULATE_TOKEN_COUNT',
          text: text,
          model: model,
          requestId: requestId
        }, '*');
        
        return true; // 비동기 응답을 위해 true 반환
      }
    } catch (error) {
      console.error('🚨 메시지 처리 중 오류 발생:', error);
      sendResponse({ error: error.message });
    }    if (message.type === 'checkDeepResearchRemaining') {
      try {
        // Deep Research 버튼 툴팁 확인 로직
        const drButton = document.querySelector("button[data-testid='deep-research-button']") ||
                        document.querySelector("button[aria-label*='deep']");
        
        if (drButton) {
          // 버튼에 마우스 오버하여 툴팁 표시 시도
          drButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          
          setTimeout(() => {
            try {
              const tooltip = document.querySelector('[role="tooltip"]') || 
                            document.querySelector('.tooltip');
              
              if (tooltip && tooltip.innerText) {
                const match = tooltip.innerText.match(/(\d+)/);
                if (match) {
                  const remaining = parseInt(match[1], 10);
                  sendResponse({ remaining });
                  return;
                }
              }
              sendResponse({ remaining: null });
            } catch (error) {
              console.error('🚨 Deep Research 툴팁 처리 중 오류:', error);
              sendResponse({ error: error.message });
            }
          }, 100);
          return true; // 비동기 응답을 위해 true 반환
        }
        sendResponse({ remaining: null });
      } catch (error) {
        console.error('🚨 Deep Research 확인 중 오류:', error);
        sendResponse({ error: error.message });
      }
    }
    return true;
  });

  function extractConversation(startId, endId) {
    // Extract messages, fallback to older DOM structure if necessary
    const chatThread = [];
    let messageEls = document.querySelectorAll('div[data-message-author-role][data-message-id]');
    // Fallback for older ChatGPT DOM
    if (!messageEls.length) {
      messageEls = document.querySelectorAll('div.group.w-full');
    }
    messageEls.forEach(msgEl => {
      // ID and sender detection
      const id = msgEl.getAttribute('data-message-id') || '';
      let sender = msgEl.getAttribute('data-message-author-role');
      if (!sender) {
        // Fallback: detect by user-icon presence
        sender = msgEl.querySelector("svg[data-icon='user']") ? 'user' : 'assistant';
      }
       // 메시지 콘텐츠 조회: user/assistant 공통
       let contentEl = msgEl.querySelector('div.whitespace-pre-wrap');
       if (!contentEl) contentEl = msgEl.querySelector('div.markdown');
       // Fallback: generic content container
       if (!contentEl) contentEl = msgEl.querySelector('div.text-base');
       if (!contentEl) return;
       // 불필요 버튼 제거
       contentEl.querySelectorAll('button').forEach(btn => btn.remove());
      const html = contentEl.innerHTML.trim().replace(/\n/g, '<br>');
      const content = contentEl.innerText.trim();
      chatThread.push({ id, sender, html, content });
     });
     return chatThread;
   }      
     // 전역 참조를 위해 window에 할당
  window.CONTEXT_MEASUREMENT = {
    lastMeasureTime: 0,     // 마지막 측정 시간
    measureInterval: 3000,  // 측정 간격 (ms)
    lastResult: null,       // 마지막 측정 결과 캐싱
    messageCountAtLastMeasure: 0, // 마지막 측정 시 메시지 수
    inProgress: false,      // 측정 진행 중 여부
    contextLimits: {
      free: 8192,           // Free 플랜: 8K 토큰
      plus: 32768,          // Plus 플랜: 32K 토큰
      pro: 131072           // Pro 플랜: 128K 토큰
    }
  };

  function calculateContextSize() {
    return new Promise((resolve) => {
      const now = Date.now();
      const conversation = extractConversation();

      // 플랜 정보 가져오기 (storage에서)
      chrome.storage.local.get('currentPlan', data => {
        const currentPlan = data.currentPlan || 'free';
        
        // 최적화: 이전 결과 재활용 조건 체크
        // 1. 마지막 측정으로부터 일정 시간이 지나지 않았고
        // 2. 측정 이후 메시지 수가 변하지 않았으면
        // 3. 캐시된 마지막 결과가 있으면
        if (
          now - window.CONTEXT_MEASUREMENT.lastMeasureTime < window.CONTEXT_MEASUREMENT.measureInterval &&
          conversation.length === window.CONTEXT_MEASUREMENT.messageCountAtLastMeasure &&
          window.CONTEXT_MEASUREMENT.lastResult
        ) {
          // 플랜이 변경되었을 수 있으므로, 한도 정보만 업데이트
          const cachedResult = {...window.CONTEXT_MEASUREMENT.lastResult};
          cachedResult.contextLimit = window.CONTEXT_MEASUREMENT.contextLimits[currentPlan];
          // console.log('🔄 캐시된 토큰 측정 결과 사용');
          return resolve(cachedResult);
        }
      
        // 중복 측정 방지
        if (window.CONTEXT_MEASUREMENT.inProgress) {
          // console.log('⌛ 이미 측정 진행 중, 잠시후 재시도하세요');
          return resolve(window.CONTEXT_MEASUREMENT.lastResult || { 
            chars: 0, 
            tokens: 0, 
            text: '',
            pending: true 
          });
        }
        
        window.CONTEXT_MEASUREMENT.inProgress = true;
      
      // 대화 내용 추출 
      let text = '';
      conversation.forEach(msg => {
        text += msg.content;
      });
      console.log('🔄 대화 내용:', text);
      
      // 문자 길이 계산
      const chars = text.length;
        // 응답 대기 타임아웃 (1.5초 후 기본값 반환)
      const timeoutId = setTimeout(() => {
        console.log('⚠️ 토큰 계산 타임아웃, 근사치 사용');
        const contextLimit = window.CONTEXT_MEASUREMENT.contextLimits[currentPlan];
        const result = { 
          chars, 
          tokens: Math.ceil(chars * 0.25), 
          text,
          contextLimit: contextLimit
        };
        
        // 결과 캐싱
        window.CONTEXT_MEASUREMENT.lastResult = result;
        window.CONTEXT_MEASUREMENT.lastMeasureTime = now;
        window.CONTEXT_MEASUREMENT.messageCountAtLastMeasure = conversation.length;
        window.CONTEXT_MEASUREMENT.inProgress = false;
        
        resolve(result);
      }, 1500);
      
      // 웹페이지 응답 수신용 리스너
      const responseListener = function(event) {
        if (event.source !== window) return;
        const data = event.data;
        
        if (data && data.type === 'CHATGPT_TOOL_CONTEXT_TOKENS') {
          // 리스너 제거 및 타임아웃 취소
          window.removeEventListener('message', responseListener);
          clearTimeout(timeoutId);
          
          console.log('✅ 정확한 토큰 계산값 수신:', data.tokens);
          const contextLimit = window.CONTEXT_MEASUREMENT.contextLimits[currentPlan];
          const result = {
            chars: data.chars,
            tokens: data.tokens,
            text: text,
            success: data.success,
            contextLimit: contextLimit
          };
            // 결과 캐싱
          window.CONTEXT_MEASUREMENT.lastResult = result;
          window.CONTEXT_MEASUREMENT.lastMeasureTime = now;
          window.CONTEXT_MEASUREMENT.messageCountAtLastMeasure = conversation.length;
          window.CONTEXT_MEASUREMENT.inProgress = false;
          
          resolve(result);
        }
      };
      
      // 응답 리스너 등록
      window.addEventListener('message', responseListener);
      
      // 웹페이지에 메시지 전송하여 토큰 계산 요청
      window.postMessage({
        type: 'CALCULATE_CONTEXT_SIZE',
        text: text,
        model: 'gpt-4o',
        chars: chars
      }, '*');
      });
    });
  }

// token-calculator.js로 대체됨
