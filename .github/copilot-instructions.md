<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

이 프로젝트는 Chrome Manifest V3 확장 프로그램 템플릿입니다. 크롬 확장 개발에 맞는 코드와 구조를 생성하세요.

- 컨텍스트 해석
    
    메인 프롬프트: 기본적인 기능 요구사항
    추가 레퍼런스: GPT로 조사한 관련 정보들
    기술적 접근: 구체화한 접근법
    기능 명세: 최종적인 개발에 사용할 기술적 접근 방안.
    
    기능 명세의 내용을 가장 우선할 것
    
- 메인 프롬프트
    
    나는 ChatGPT Chrome 보조 확장 프로그램을 만들 것이다. 주요한 기능은 다음과 같다.
    
    1. 메시지 갯수 카운트 지원
        - 각 **모델별** 요청 횟수를 실시간으로 카운트하고 표시
        - 월별 또는 일별로 사용 가능한 요청 수 한도를 설정하고, 남은 사용 횟수를 표시하는 기능 제공
        - 요청 횟수가 한도에 가까워질 때 알림(경고) 제공
        - 요청 한도가 초과될 위험이 있는 경우, 사용자에게 사전에 경고 메시지를 통해 관리 지원
        - 과거 데이터 기반으로 월별/일별 사용량 추세를 시각화하여 효율적인 관리 지원
    2. 딥리서치 남은 갯수 출력
        - 유료 플랜에서 제공되는 "딥리서치" 기능의 사용 횟수를 실시간으로 추적 및 표시
        - 일일 또는 월별 리셋까지의 남은 시간을 카운트다운 타이머로 표시
    3. 대화 기록 내보내기
        - 현재 대화를 PDF, 텍스트 파일(.txt), 마크다운(.md), 또는 JSON 형식으로 내보내기 지원
        - 대화 내 특정 메시지 구간을 지정하여 부분적으로만 내보내기 가능
        - 내보낼 때 메시지 발신자(사용자 또는 ChatGPT) 구분, 날짜, 시간 등 메타데이터 포함
    4. 컨텍스트 크기 계산(대화기록 기준)
        - 현재 대화의 컨텍스트 길이를 토큰 수 또는 문자 수로 실시간으로 계산하여 표시
        - 컨텍스트 크기가 각 모델의 최대 허용 범위에 가까워지면 시각적 경고 표시 제공
        - 모델별 최대 컨텍스트 크기 대비 사용 비율을 직관적으로 표현한 프로그레스 바 제공
    5. 사용패턴 분석&모델별 통계
        - 사용자가 주로 사용하는 시간대 분석을 통해 사용 습관 시각화 제공
        - 사용 빈도가 높은 모델 및 각 모델의 메시지 처리 속도, 응답 시간 등 성능 통계 제공
        - 기간별로 모델의 사용량 추세를 그래프 형태로 제시하여 모델 사용패턴 분석 제공
- 추가 레퍼런스
    
    (※ URL 대신 소스 ID로 표기합니다.)
    
    ---
    
    ## 1. 모델별 메시지 카운트 & 한도 관리
    
    | 목적 | 참고 자료 | 메모 |
    | --- | --- | --- |
    | 크롬 확장 예제 (모델별 카운트) | napspans **chatGPT4-message-counter-ext** ([GitHub](https://github.com/napspans/chatGPT4-message-counter-ext?utm_source=chatgpt.com)) | GPT-4 3-시간 50 회 한도 추적·UI 흐름 참고 |
    | 크롬 스토어 배포 사례 | **Chatterclock** (AI-모델별 요청 수 트래커) ([Chrome 웹스토어](https://chromewebstore.google.com/detail/chatterclock-%E2%80%94-a-chatgpt/mepflplnjbngmgakdefimlgbfpmhonoj?utm_source=chatgpt.com)) | 화면 구성, 세션 분리 방식 참고 |
    | 토큰 카운트용 Tampermonkey 스크립트 | **Token-Counter-for-ChatGPT** ([GitHub](https://github.com/SpriteSixis/Token-Counter-for-ChatGPT?utm_source=chatgpt.com)) | 실시간 토큰 계산 로직(JS ＋ tiktoken) |
    | 커뮤니티 스크립트 공유 | “I made a script to track GPT-4 messages” ([Reddit](https://www.reddit.com/r/ChatGPTPro/comments/18lkn6b/i_made_a_script_to_track_how_many_gpt4_messages/?utm_source=chatgpt.com)) | 사용자 피드백·한도 우회 팁 포함 |
    | 오픈AI 공식 사용량 API | **/docs/api-reference/usage** ([OpenAI Platform](https://platform.openai.com/docs/api-reference/usage?utm_source=chatgpt.com), [OpenAI Platform](https://platform.openai.com/docs/api-reference?utm_source=chatgpt.com)) | 일·월 사용량 JSON 엔드포인트, 한도 잔량 계산 가능 |
    | 한도 임박 알림 UX 참고 | **ChatGPT-Timer** (타이머 + 알림) ([GitHub](https://github.com/PositiveVibrations/ChatGPT-Timer?utm_source=chatgpt.com)) | Badge/notification 구현 예 |
    
    ---
    
    ## 2. 딥리서치(Perplexity 등) 잔여 횟수 추적
    
    | 목적 | 참고 자료 | 메모 |
    | --- | --- | --- |
    | 공식 기능 소개 | Perplexity **Introducing Deep Research** 블로그 ([Perplexity AI](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research?utm_source=chatgpt.com)) | 요청-당 내부 API 호출량·리셋 주기 언급 |
    | 한도 경험담·쿼터 | Reddit “Deep Research word limit for Pro Users” ([Reddit](https://www.reddit.com/r/perplexity_ai/comments/1iq6p4j/deep_research_word_limit_for_pro_users/?utm_source=chatgpt.com)) | 실제 일일 500 쿼리, 글자수 제한값 제보 |
    | 요청 횟수 캡처 팁 | Wireshark TCP Dump Analyzer GPT ([Toolify](https://www.toolify.ai/gpts/g-VQAlpoZ9n?utm_source=chatgpt.com)) | 네트워크 패킷에서 X-Usage-Limit 등 헤더 추출 가능 |
    
    ---
    
    ## 3. 대화 기록 내보내기
    
    | 목적 | 참고 자료 | 메모 |
    | --- | --- | --- |
    | 마크다운/PDF 내보내기 CLI | **chatgpt-chat-exporter** ([GitHub](https://github.com/rashidazarang/chatgpt-chat-exporter?utm_source=chatgpt.com)) | JS-only, DOM 파싱 → md/pdf 변환 로직 |
    | 기능 요청·UX 의견 | OpenAI 포럼 스레드 “export chat as markdown/pdf” ([OpenAI Community](https://community.openai.com/t/export-chat-as-a-markdown-pdf/760565?utm_source=chatgpt.com)) | 메타데이터, 부분 선택 니즈 정리 |
    | 토큰/메시지 당 소비량 표시 | **ChatGPT Consumption** 확장 ([Chrome 웹스토어](https://chromewebstore.google.com/detail/chatgpt-consumption/inlfplkijidejppdffcpehojlpndjigi?hl=en&utm_source=chatgpt.com)) | 토큰과 함께 저장하는 방법 참고 |
    
    ---
    
    ## 4. 컨텍스트(토큰) 크기 계산
    
    | 목적 | 참고 자료 | 메모 |
    | --- | --- | --- |
    | 공식 JS 토크나이저 | **tiktoken** npm 패키지 ([npm](https://www.npmjs.com/package/tiktoken?utm_source=chatgpt.com), [npm](https://www.npmjs.com/package/js-tiktoken?utm_source=chatgpt.com)) | WASM 지원, 모델별 encoder 포함 |
    | 실시간 토큰 UI 예제 | Tampermonkey Token Counter 스크립트 ([GitHub](https://github.com/SpriteSixis/Token-Counter-for-ChatGPT?utm_source=chatgpt.com)) | 키입력 이벤트 → debounce → 토큰 수 표시 |
    | 네트워크 오류/403 케이스 | Reddit 크로미움-패킷 분석글 ([Reddit](https://www.reddit.com/r/paloaltonetworks/comments/124o2d1/chatgpt_and_chromium_browser_issues/?utm_source=chatgpt.com)) | 컨텍스트 초과 시 서버 응답 패턴 파악 |
    
    ---
    
    ## 5. 사용 패턴 분석 & 모델별 통계
    
    | 목적 | 참고 자료 | 메모 |
    | --- | --- | --- |
    | 공식 사용량 JSON → 차트 | OpenAI **usage API** 문서 ([OpenAI Platform](https://platform.openai.com/docs/api-reference/usage?utm_source=chatgpt.com), [OpenAI Platform](https://platform.openai.com/docs/api-reference?utm_source=chatgpt.com)) | date_range, aggregation_level 지원 |
    | 사용자 모델 분포 UI | **Chatterclock** 확장 ([Chrome 웹스토어](https://chromewebstore.google.com/detail/chatterclock-%E2%80%94-a-chatgpt/mepflplnjbngmgakdefimlgbfpmhonoj?utm_source=chatgpt.com)) | 모델별 badge/컬러 코딩 예 |
    | 과거 트렌드 시각화 영감 | ChatGPT-Consumption 스토어 페이지 ([Chrome 웹스토어](https://chromewebstore.google.com/detail/chatgpt-consumption/inlfplkijidejppdffcpehojlpndjigi?hl=en&utm_source=chatgpt.com)) | per-conversation 누적 토큰 그래프 |
    | 패킷 기반 세션 식별 | Wireshark 분석 GPT 도구 ([Toolify](https://www.toolify.ai/gpts/g-VQAlpoZ9n?utm_source=chatgpt.com)) | request_id 로 세션 묶기 가능 |
    
    ---
    
    ### 활용 제안
    
    1. **네트워크 계측 → API 통계 취합**
        - `chrome.webRequest`로 `backend-api/conversation` POST 헤더를 가로채고, model 필드·timestamp 저장.
        - 오픈AI Usage API와 대조하여 과금 기준과 싱크 맞추기.
    2. **토큰 계산 모듈**
        - `tiktoken` WASM 로드 → 프롬프트 입력 시 실시간 토큰 업데이트.
        - 대화 스크롤 영역 DOM을 관찰해 “누적 토큰 / 최대 토큰” 프로그레스 바 표시.
    3. **내보내기 파이프라인**
        - DOM 파싱 → `remark`로 Markdown AST 구성 → `pdf-lib`로 PDF 렌더.
        - 선택 구간은 메시지 ID range로 필터.
    4. **스케줄러 & 알림**
        - Chrome alarms API로 한도 임박 시 badge color 변경 + desktop notification.
        - Deep Research 일일 reset 타이머는 `Date.now()` + UTC reset 00:00 계산.
- 기술적 접근
    
    아래에서는 요청하신 세 가지 기능(① 메시지 카운트, ② 딥리서치 남은 횟수 추적, ③ 대화 기록 확인/내보내기)을 “크롬 확장” 형태로 기술적으로 구현하기 위해 참고할 만한 구체적인 방법들을 정리했습니다. 각 구현 아이디어마다 실제 오픈소스‧스크립트‧분석 글 등을 함께 인용하였으니, 바로 프로토타입 개발에 활용하실 수 있습니다.
    
    ---
    
    ## 1. 메시지 개수 카운트 (모델별 요청 횟수 추적)
    
    ### 1-1. 네트워크 레이어 가로채기 (chrome.webRequest)
    
    - **개요**
        
        ChatGPT 웹 UI가 백엔드와 주고받는 HTTP 요청(특히 `/backend-api/conversation` 혹은 유사 엔드포인트)을 `chrome.webRequest` API로 후킹(hooking)하여, 요청 본문(body) 혹은 응답에서 사용된 모델 정보를 추출하고 횟수를 계산할 수 있습니다.
        
    - **기술 포인트**
        1. `manifest.json`에 `"permissions": ["webRequest", "webRequestBlocking", "https://chat.openai.com/*"]` 등을 추가하여 네트워크 요청을 모니터링할 수 있게 합니다.
        2. `background.js`(혹은 service worker)에 아래와 같은 리스너를 등록합니다.
        
        ```
        chrome.webRequest.onBeforeRequest.addListener(
          (details) => {
            // details.requestBody.raw 혹은 details.requestBody.formData 내 JSON 페이로드 파싱
            // 예: JSON.parse(decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes))))
            // → payload.model 값 확인 (예: "gpt-4", "gpt-3.5-turbo" 등)
            // → 모델별 카운트 변수 증분
          },
          { urls: ["https://chat.openai.com/backend-api/conversation*"] },
          ["requestBody"]
        );
        
        ```
        
        1. 다만, Chrome 확장의 기본 `onBeforeRequest`는 **request body**(요청 본문) 접근 권한이 제한적입니다(자바스크립트로 encode된 형태만). 실제로 본문 전체를 파싱하려면 `chrome.declarativeNetRequest` 대신 **`chrome.debugger`** 혹은 “response body” 가로채기를 위해 “Service Worker + fetch override” 방식을 조합해야 합니다.
    - **참고 자료**
        - napspans의 “chatGPT4-message-counter-ext” 레포: ChatGPT4 한도(3시간당 50회) 추적 예제가 포함되어 있으며, `webRequest`로 모델별 카운팅 기법을 참고할 수 있음 ([GitHub](https://github.com/napspans/chatGPT4-message-counter-ext?utm_source=chatgpt.com))
        - StackOverflow “Intercept HTTP request body from chrome extension” 토론: `onBeforeRequest` 시 requestHeaders만 접근 가능한 점, 본문 파싱 제한 이슈와 우회법 언급 ([Stack Overflow](https://stackoverflow.com/questions/11593853/intercept-http-request-body-from-chrome-extension?utm_source=chatgpt.com))
    
    ### 1-2. 프론트엔드 레이어 가로채기 (DOM Mutation / XHR Override)
    
    - **개요**
        
        ChatGPT 웹 페이지의 자바스크립트 코드가 API 호출을 직접 수행하므로, 브라우저 확장에서 페이지 로드 시점에 “XHR/Fetch” 함수를 덮어씌워서 요청 파라미터(model 등)를 가로채는 방식도 있습니다.
        
    - **기술 포인트**
        1. **content script**에서 `XMLHttpRequest.prototype.send` 혹은 `window.fetch`를 프록시로 덮어씌웁니다.
        
        ```
        const origFetch = window.fetch;
        window.fetch = async function(input, init) {
          // init.body(JSON.stringify payload) 파싱 → 모델 정보 확인
          // 예: const payload = JSON.parse(init.body);
          // → payload.model 값으로 카운트 로직 호출
          return origFetch(input, init);
        };
        
        ```
        
        1. 이 방법의 장점은 requestBody 전체를 쉽게 확인할 수 있다는 점이며, 브라우저 내부에서 발생하는 모든 fetch 요청을 모니터링할 수 있습니다. 단, ChatGPT UI가 내부적으로 어떤 패턴으로 fetch를 호출하는지(예: 특정 서비스 경로, 헤더 등)를 파악해야 합니다.
    - **참고 자료**
        - Reddit “I made a cool browser extension to track GPT-4’s usage cap” 글: XHR 덮어씌우기(fetch override)로 모델별 요청 정보를 추출한 사례 ([Reddit](https://www.reddit.com/r/ChatGPT/comments/15dlhbt/hey_i_made_a_cool_browser_extension_to_track/?utm_source=chatgpt.com))
        - “Chrome Extension Help: How can I intercept network responses in a clean way?” 토론: `window.fetch` 오버라이드 vs `chrome.webRequest` 차이점 비교 ([Reddit](https://www.reddit.com/r/webdev/comments/1erd9bt/chrome_extension_help_how_can_i_intercept_network/?utm_source=chatgpt.com))
    
    ### 1-3. 모델별 카운트 저장·UI 표시
    
    - **저장 구조**
        - 백그라운드 스크립트에서 모델별로 다음과 같은 형태로 저장:
            
            ```
            let usageCounts = {
              "gpt-3.5-turbo": { daily: 0, monthly: 0 },
              "gpt-4": { daily: 0, monthly: 0 },
              "gpt-4o": { daily: 0, monthly: 0 },
              // … 필요 모델 추가
            };
            
            ```
            
        - `chrome.storage.local` 혹은 IndexedDB에 일별(日)·월별(月) 누적 값을 기록.
    - **UI 컴포넌트**
        1. **확장 아이콘 뱃지(Badge)**: 모델별 합계나 “전체 메시지 수”를 요약해 Badge로 표시 가능
        2. **팝업창(popup.html)**:
            - Day/Month 라디오 버튼으로 전환하여 모델별 요청 횟수 테이블 표시
            - 경고(⚠️) 아이콘: 특정 모델 사용 횟수가 설정한 한도(`limit.gpt-4 = 40회/일` 등)에 근접했을 때 색상 변경(예: 노랑→빨강)
        3. **시각화**: 간단한 막대그래프(Chart.js 등)로 일별·월별 모델 사용량 추세를 표시 가능
    - **참고 자료**
        - Chatterclock 확장: AI 모델별 요청 수 트래커 사례로, Badge 및 팝업 UI 설계 참고 ([OpenAI 도움말 센터](https://help.openai.com/en/articles/10500283-deep-research-faq?utm_source=chatgpt.com), [Chrome 웹스토어](https://chromewebstore.google.com/detail/chatgpt-prompt-counter/djmjoepmfiooddjlmnagnnanhbjpdjkp?hl=en&utm_source=chatgpt.com))
        - “Token Counter for ChatGPT” 확장: 토큰 카운터이지만, UI 구성 구조가 유사하며 storage 동기화 방식이 참고됨 ([GitHub](https://github.com/VendenIX/tokenCounterChatGPT/?utm_source=chatgpt.com))
    
    ---
    
    ## 2. 딥리서치 남은 횟수 출력
    
    ### 2-1. 공식 UI 요소(Deep Research 버튼) 파싱
    
    - **개요**
        
        ChatGPT 웹 UI 상단 혹은 사이드바에 있는 “Deep Research” 버튼에 마우스를 올리면 남은 횟수가 툴팁으로 표시됩니다. 이 정보를 가로채려면 해당 버튼의 DOM을 관찰하거나 hover 이벤트 시 innerText를 읽어오는 방식이 있습니다.
        
    - **기술 포인트**
        
        ```
        // content script 예시
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            const btn = document.querySelector("button[data-testid='deep-research-button']");
            if (btn) {
              // hover 이벤트 리스너 부착
              btn.addEventListener("mouseover", () => {
                // 툴팁 엘리먼트 내부에 "남은 횟수: XX tasks" 형태로 표시됨
                const tooltip = document.querySelector(".tooltip-selector");
                if (tooltip) {
                  const text = tooltip.innerText;
                  // 정규표현식으로 숫자만 추출
                  const remaining = parseInt(text.match(/(\d+)\s*tasks/)[1], 10);
                  // 저장하거나 UI에 갱신
                }
              }, { once: true });
              observer.disconnect();
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        ```
        
    - **참고 자료**
        - OpenAI Help Center “Deep Research FAQ”: 버튼에 마우스 오버 시 남은 횟수 확인 방법 설명 ([OpenAI 도움말 센터](https://help.openai.com/en/articles/10500283-deep-research-faq?utm_source=chatgpt.com))
        - Reddit “Any way to see Deep Research queries remaining per month?”: UI에서 남은 횟수가 사라졌거나 비공개된 경우 대안 탐색 논의 ([Reddit](https://www.reddit.com/r/ChatGPTPro/comments/1isvr99/any_way_to_see_deep_research_queries_remaining/?utm_source=chatgpt.com))
    
    ### 2-2. 네트워크 호출 분석 (X-Usage-Limit 헤더 확인)
    
    - **개요**
        
        Deep Research도 내부 API 호출 시 응답 헤더에 남은 횟수(Quota) 정보를 담아줄 가능성이 있습니다. 실제 트래픽을 캡처하여 `X-Usage-*` 혹은 유사한 헤더를 확인한 뒤, 남은 횟수를 API 응답에서 직접 추출하는 방법입니다.
        
    - **기술 포인트**
        1. `chrome.webRequest.onHeadersReceived`를 사용해 Deep Research 관련 API 응답 헤더를 가로채기:
            
            ```
            chrome.webRequest.onHeadersReceived.addListener(
              (details) => {
                const headers = details.responseHeaders;
                for (const h of headers) {
                  if (h.name.toLowerCase().startsWith("x-deep-research-remaining")) {
                    const remaining = parseInt(h.value, 10);
                    // 확장 내 변수에 저장 및 UI 반영
                  }
                }
              },
              { urls: ["https://chat.openai.com/backend-api/deep-research*"] },
              ["responseHeaders"]
            );
            
            ```
            
        2. 만약 공식 헤더가 존재하지 않으면 “fetch override” 방식으로 API 응답(body)에 남은 횟수를 포함하는 JSON 필드를 찾아 파싱할 수도 있습니다.
    - **참고 자료**
        - “Wireshark TCP Dump Analyzer GPT” 글: 네트워크 패킷에서 `X-Usage-Limit` 등 헤더 추출 방법 소개 ([Medium](https://medium.com/%40ddamico.125/intercepting-network-response-body-with-a-chrome-extension-b5b9f2ef9466?utm_source=chatgpt.com))
        - Reddit “ChatGPT Deep Research reduced and hidden how many left”: 최근 UI에서 남은 횟수를 숨긴 사례 분석, 네트워크 헤더로 대체 방법 모색 ([OpenAI Community](https://community.openai.com/t/deep-research-reduced-and-hidden-how-many-left/1273428?utm_source=chatgpt.com))
    
    ### 2-3. 시간 계산 및 알림
    
    - **남은 시간 카운트다운**
        - Deep Research는 “일/월 단위”로 리셋되므로, 실제 남은 시간을 계산하기 위해 사용자의 타임존(Asia/Seoul) 기준으로 매일 자정(UTC+9 00:00)에 초기화를 고려해야 합니다.
        - 예시 로직:
            
            ```
            function getNextResetTimestamp() {
              const now = new Date();
              // 오늘 00:00 (KST) 지점
              const kstMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
              // 만약 현재 시각이 kstMidnight 지난 후라면, 다음날 00:00
              if (now.getTime() >= kstMidnight.getTime()) {
                kstMidnight.setUTCDate(kstMidnight.getUTCDate() + 1);
              }
              return kstMidnight.getTime();
            }
            
            // 남은 시간 (ms 단위)
            const remainingMs = getNextResetTimestamp() - Date.now();
            
            ```
            
        - 확장에서 `setInterval`로 1분마다 `remainingMs`를 업데이트해 카운트다운 표시 가능
    - **알림(Notifications/Balloon)**
        - 특정 임계치(예: 10회 이하) 이하로 남으면
            
            ```
            chrome.notifications.create({
              type: "basic",
              iconUrl: "deep-research-icon.png",
              title: "Deep Research 남은 횟수 경고",
              message: `Deep Research 남은 횟수가 ${remaining}회 남았습니다.`
            });
            
            ```
            
    - **참고 자료**
        - Deep Research 공식 FAQ: “일일 리셋 기준” 정보 포함 ([OpenAI 도움말 센터](https://help.openai.com/en/articles/10500283-deep-research-faq?utm_source=chatgpt.com))
        - 블로그 “Introducing deep research - OpenAI”: Pro 사용자의 월별 쿼터(125회)의 리셋 주기 언급 ([The Guardian](https://www.theguardian.com/technology/2025/feb/03/openai-deep-research-agent-chatgpt-deepseek?utm_source=chatgpt.com))
    
    ---
    
    ## 3. 대화 기록 확인 및 내보내기
    
    ### 3-1. DOM 파싱을 통한 메시지 수집
    
    - **개요**
        
        ChatGPT 웹페이지에서 대화 메시지는 `<div class="group w-full">` 같은 구조로 렌더링됩니다. 확장 내 **content script**가 해당 DOM을 순회하며 메시지별로 발신자, 타임스탬프, 텍스트 콘텐츠를 추출하면, 전체 대화를 배열 형태로 재구성할 수 있습니다.
        
    - **기술 포인트**
        
        ```
        function extractConversation() {
          const msgs = document.querySelectorAll("div.group.w-full");
          const conv = [];
          msgs.forEach((m) => {
            // 예: 사용자 메시지는 왼쪽 정렬, ChatGPT는 오른쪽 정렬의 클래스로 구분
            const isUser = m.querySelector("svg[data-icon='user']") !== null;
            const textEl = m.querySelector("div.markdown");
            const tsEl = m.querySelector("time");
            conv.push({
              sender: isUser ? "user" : "assistant",
              timestamp: tsEl ? tsEl.getAttribute("datetime") : "",
              content: textEl ? textEl.innerText.trim() : "",
            });
          });
          return conv;
        }
        
        ```
        
    - **참고 자료**
        - Reddit “Chrome Extension: save ChatGPT conversations to markdown” 스레드: 대화 메시지 DOM 구조 분석, 마크다운(.md) 변환 방법 예시 ([Reddit](https://www.reddit.com/r/ChatGPT/comments/10k16ij/chrome_extension_save_chatgpt_conversations_to/?utm_source=chatgpt.com))
        - “ChatGPT: Chat Log Export (JSON)” 확장: 현재 ChatGPT 메시지를 JSON 형태로 바로 다운로드하는 간단한 구현 예 ([Chrome 웹스토어](https://chromewebstore.google.com/detail/chatgpt-chat-log-export-j/gejpagcjdocpgpnblmknkfpbdjkeocpd?hl=en&utm_source=chatgpt.com))
    
    ### 3-2. 파일 포맷별 내보내기
    
    ### 3-2-1. Markdown(.md) 및 텍스트(.txt)
    
    - **Markdown 포맷 예시**
        
        ```
        # ChatGPT 대화 내보내기
        
        **사용자 (2025-06-02 14:35:10):**
        안녕하세요, ChatGPT.
        
        **Assistant (2025-06-02 14:35:20):**
        안녕하세요! 무엇을 도와드릴까요?
        
        …(이하 반복)
        
        ```
        
    - **구현 절차**
        1. 위에서 추출한 `conv` 배열을 순회하며 Markdown 형태의 문자열 생성
        2. Blob 생성: `new Blob([markdownString], { type: "text/markdown;charset=utf-8" })`
        3. `chrome.downloads.download({ url: URL.createObjectURL(blob), filename: "chat.md" })`
    - **참고 자료**
        - “chatgpt-chat-exporter” 오픈소스: DOM → Markdown AST → `.md`/`.pdf`로 변환하는 라이브러리 참조 ([DEV Community](https://dev.to/jcubic/save-chatgpt-as-html-file-dhh?utm_source=chatgpt.com))
    
    ### 3-2-2. JSON
    
    - **구현 절차**
        1. `conv` 배열을 `JSON.stringify(conv, null, 2)`로 직렬화
        2. Blob 생성: `new Blob([jsonString], { type: "application/json;charset=utf-8" })`
        3. 다운로드 API 호출
    - **참고 자료**
        - “ChatGPT: Chat Log Export (JSON)” 확장: 이미 JSON 형식으로 내보내는 단순 구현 샘플 ([Chrome 웹스토어](https://chromewebstore.google.com/detail/chatgpt-chat-log-export-j/gejpagcjdocpgpnblmknkfpbdjkeocpd?hl=en&utm_source=chatgpt.com))
    
    ### 3-2-3. PDF
    
    - **개요**
        1. 브라우저 측 PDF 생성을 위해 **pdf-lib**나 **jsPDF** 같은 클라이언트 라이브러리를 활용
        2. 만들어둔 Markdown이나 HTML을 변환하여 PDF로 렌더링
    - **기술 포인트**
        - 예를 들어 **pdf-lib**:
            
            ```
            import { PDFDocument, StandardFonts } from 'pdf-lib';
            
            async function generatePDF(conv) {
              const pdfDoc = await PDFDocument.create();
              const page = pdfDoc.addPage();
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              let y = page.getHeight() - 50;
              conv.forEach((msg) => {
                const text = `【${msg.sender}】 ${msg.timestamp}\n${msg.content}\n\n`;
                page.drawText(text, { x: 50, y, size: 12, font });
                y -= font.heightAtSize(12) * (text.split('\n').length + 1);
                if (y < 50) {
                  y = page.getHeight() - 50;
                  page.addPage();
                }
              });
              const pdfBytes = await pdfDoc.save();
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              chrome.downloads.download({ url: URL.createObjectURL(blob), filename: 'chat.pdf' });
            }
            
            ```
            
        - DOM → HTML 문자열 변환 후 **html2pdf.js** 등을 써도 가능
    - **참고 자료**
        - “chatgpt-chat-exporter” 레포: Markdown AST → PDF 렌더링 흐름 참조 ([DEV Community](https://dev.to/jcubic/save-chatgpt-as-html-file-dhh?utm_source=chatgpt.com))
    
    ---
    
    ### 3-3. “특정 구간” 선택 내보내기
    
    - **구현 아이디어**
        1. 사용자가 확장 UI 혹은 페이지 내에 “시작 메시지 ID”와 “끝 메시지 ID”를 지정할 수 있도록 마커(marker) 버튼을 제공
        2. `extractConversation()` 호출 시, ID 기반으로 필터링:
            
            ```
            function extractConversationRange(startId, endId) {
              const msgs = document.querySelectorAll("div.group.w-full");
              const conv = [];
              let recording = false;
              msgs.forEach((m) => {
                const id = m.getAttribute("data-message-id");
                if (id === startId) recording = true;
                if (recording) {
                  // 메시지 파싱 로직 (sender, timestamp, content)
                  conv.push(...);
                }
                if (id === endId) recording = false;
              });
              return conv;
            }
            
            ```
            
    - **참고 자료**
        - OpenAI 포럼 “Decoding Exported Data by Parsing conversations.json and/or chat.html”: 선택 범위 지정 후 재구성 아이디어 ([OpenAI Community](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144?utm_source=chatgpt.com))
    
    ---
    
    ## 요약
    
    1. **메시지 개수 카운트**는
        - `chrome.webRequest` 혹은 **fetch override**로 `/backend-api/conversation` 요청의 JSON 페이로드에서 `model` 필드를 파싱하여 횟수를 집계하는 방식
        - 카운트 정보는 `chrome.storage.local`에 저장하고, 확장 아이콘 배지·팝업 UI에서 모델별/일별/월별을 시각화
        - napspans 등 오픈소스 예제를 바탕으로 빠르게 프로토타입 가능 ([GitHub](https://github.com/napspans/chatGPT4-message-counter-ext?utm_source=chatgpt.com), [Reddit](https://www.reddit.com/r/ChatGPT/comments/15dlhbt/hey_i_made_a_cool_browser_extension_to_track/?utm_source=chatgpt.com), [Reddit](https://www.reddit.com/r/webdev/comments/1erd9bt/chrome_extension_help_how_can_i_intercept_network/?utm_source=chatgpt.com))
    2. **딥리서치 남은 횟수 출력**은
        - UI 상의 “Deep Research” 버튼 hover 시 툴팁으로 노출되는 카운트를 DOM 파싱으로 가져오거나 ([OpenAI 도움말 센터](https://help.openai.com/en/articles/10500283-deep-research-faq?utm_source=chatgpt.com), [OpenAI Community](https://community.openai.com/t/deep-research-reduced-and-hidden-how-many-left/1273428?utm_source=chatgpt.com))
        - 네트워크 레이어(`chrome.webRequest.onHeadersReceived`)에서 응답 헤더의 `X-Deep-Research-Remaining` 값을 읽어오는 방식 ([Medium](https://medium.com/%40ddamico.125/intercepting-network-response-body-with-a-chrome-extension-b5b9f2ef9466?utm_source=chatgpt.com))
        - 매일 00:00 KST 기준 리셋까지 남은 시간을 계산해 카운트다운 및 알림 표시
    3. **대화 기록 확인/내보내기**는
        - content script에서 채팅 메시지를 담고 있는 `<div>` 요소를 순회해 JSON 객체(발신자·타임스탬프·콘텐츠) 배열로 재구성 ([Reddit](https://www.reddit.com/r/ChatGPT/comments/10k16ij/chrome_extension_save_chatgpt_conversations_to/?utm_source=chatgpt.com), [Chrome 웹스토어](https://chromewebstore.google.com/detail/chatgpt-chat-log-export-j/gejpagcjdocpgpnblmknkfpbdjkeocpd?hl=en&utm_source=chatgpt.com))
        - Markdown, JSON, PDF 등 파일 포맷으로 변환 후 Blob + `chrome.downloads.download` 호출로 다운로드
        - 선택 구간 지정 시에는 “시작ID/끝ID” 기반 필터링 로직 적용 ([OpenAI Community](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144?utm_source=chatgpt.com))
    
    위 구현 방식들을 참조하여, 실제 Extension 코드 구조(Manifest → Background/Content Script → Popup/Options)와 UI 컴포넌트를 빠르게 설계할 수 있습니다. 필요한 참조 코드를 복사·수정하면 프로토타입을 짧은 시간 내에 완성할 수 있으며, 이후 UX 다듬기 및 오류 처리(예: 페이로드 포맷 변화, API 버전 업데이트)를 병행하시면 됩니다.
    
- 기능 명세
    
    아래 내용은 제시된 요구사항(메시지 카운트, 딥리서치 남은 횟수 추적, 대화 기록 내보내기, 컨텍스트 크기 계산, 사용 패턴/모델 통계)을 하나의 크롬 확장 프로그램에서 어떻게 구현할지에 대한 기능 명세와 기술적 접근 방안을 요약·정리한 것입니다.
    
    ---
    
    ## 1. 메시지 갯수 카운트 (모델별 요청 횟수 추적)
    
    ### 1-1. 기능 명세
    
    - **모델별**로 메시지 요청 횟수를 추적하고, 일별/월별 누적값과 남은 한도를 표시한다.
    - 남은 횟수가 특정 임계치 이하로 내려가면 시각적 경고 또는 브라우저 알림을 띄운다.
    - 과거 데이터 기반으로 월별/일별 사용량 추세 그래프를 표시한다.
    
    ### 1-2. 기술적 접근
    
    ### A) 네트워크 요청 가로채기 (`chrome.webRequest`)
    
    - `manifest.json`에 `"permissions": ["webRequest", "webRequestBlocking", "https://chat.openai.com/*"]` 등을 추가.
    - `background.js` 또는 Service Worker에서 `onBeforeRequest` 리스너를 등록해, `/backend-api/conversation` 등 ChatGPT API에 대한 POST 요청을 탐지.
    - 요청 본문(body)에서 `model` 필드를 파싱해 `model별 카운팅` 수행.
    - 주의점: requestBody 접근 권한이 제한적이므로, 실제 JSON 파싱이 필요한 경우 **fetch override** 방식과 함께 고려해야 함.
    
    ### B) 프론트엔드 계층(Fetch/XHR) 오버라이드
    
    - Content script에서 `window.fetch` 또는 `XMLHttpRequest.send`를 덮어써, 요청할 때 넘기는 `body`(JSON)에서 `model` 정보를 파싱한다.
    - DOM 레벨에서 접근하므로 ChatGPT 내부 fetch 로직에 의존하지만, Request Body를 온전히 얻을 수 있다는 장점이 있음.
    
    ### C) 데이터 저장 및 UI 구현
    
    - 모델별 카운트 구조 예:
        
        ```
        let usageCounts = {
          "gpt-3.5-turbo": { daily: 0, monthly: 0, limitPerDay: 100, limitPerMonth: 1000 },
          "gpt-4": { daily: 0, monthly: 0, limitPerDay: 50,  limitPerMonth: 500  },
          // ...
        };
        
        ```
        
    - `chrome.storage.local`에 주기적으로 저장(일/월 기준 리셋 시점에 맞춰 0으로 초기화).
    - 확장 아이콘(Popup.html)에서는
        - **모델별 요청 수**와 **남은 한도**를 표 형태로 표시
        - 한도 임박 시 색상을 빨간색 등으로 변경
        - 작은 차트(예: Chart.js)로 일간/월간 모델별 사용 추세 시각화.
    
    ---
    
    ## 2. 딥리서치 남은 횟수(Deep Research) 추적
    
    ### 2-1. 기능 명세
    
    - Deep Research 기능(예: Perplexity나 ChatGPT Pro의 고급검색 등)의 남은 사용 횟수를 실시간 표시.
    - 일일/월별 리셋 시점까지의 카운트다운 타이머 제공.
    - 남은 횟수가 임계치 이하가 될 경우 브라우저 알림(Desktop Notification)으로 경고.
    
    ### 2-2. 기술적 접근
    
    ### A) DOM 파싱을 통한 툴팁 정보 추출
    
    - 만약 ChatGPT(또는 Perplexity 등) 웹 UI에 “Deep Research 남은 횟수”가 툴팁 형태로 표시된다면, Content script에서 해당 버튼(`button[data-testid="deep-research-button"]` 등)의 hover 이벤트 감지.
    - 툴팁(예: `.tooltip-selector`) innerText를 파싱해 남은 횟수 추출.
    
    ### B) 네트워크 응답 헤더 확인
    
    - 딥리서치 관련 API 호출(`.../deep-research` 등)을 `chrome.webRequest.onHeadersReceived`로 감시.
    - 응답 헤더 중 `X-Deep-Research-Remaining`, `X-Usage-Limit` 등이 있으면 파싱하여 남은 횟수를 업데이트.
    
    ### C) 리셋 시점 계산
    
    - Deep Research가 **일 단위**(또는 **월 단위**)로 초기화된다면, 해당 타임존(UTC 또는 KST 등)에 맞춰 자정(또는 매월 1일 00:00) 시간까지 남은 시간 계산.
    - 크롬 알람(alarms API) 또는 `setInterval` 등을 통해 카운트다운을 업데이트하고, 리셋 후 자동 0으로 초기화.
    
    ---
    
    ## 3. 대화 기록 내보내기
    
    ### 3-1. 기능 명세
    
    - 현재까지의 대화 내용을 PDF, 텍스트(.txt), 마크다운(.md), JSON 등 다양한 포맷으로 내보낼 수 있다.
    - 내보낼 범위를 특정 메시지 구간으로 제한할 수 있다(부분 내보내기).
    - 메시지 발신자(사용자/ChatGPT)·날짜·시간 등 메타데이터도 함께 포함.
    
    ### 3-2. 기술적 접근
    
    ### A) DOM 파싱으로 메시지 추출
    
    - Content script에서 ChatGPT의 대화 영역(예: `div.group.w-full`)을 순회하며, 각 메시지에 대해:
        - 발신자 구분(사용자/어시스턴트)
        - 타임스탬프(time 태그 or 별도 표시)
        - 내용(텍스트/마크다운)
        - 메시지 ID(`data-message-id`) 등이 존재한다면 함께 추출
    - 추출 결과를 배열 형태(`[{sender, timestamp, content, id}, ...]`)로 구성.
    
    ### B) 파일 포맷별 변환
    
    1. **Markdown / 텍스트**
        - 문자열 형태로 구성 → Blob → `chrome.downloads.download` 이용하여 저장.
        
        ```
        const markdownString = conv.map(msg =>
          `**${msg.sender}** (${msg.timestamp}):\n\n${msg.content}\n\n`
        ).join('---\n');
        
        ```
        
    2. **JSON**
        - `JSON.stringify(conv, null, 2)` → Blob → 다운로드.
    3. **PDF**
        - jsPDF, pdf-lib 등 라이브러리 활용.
        - DOM or Markdown → PDF로 렌더링 후 Blob 다운로드.
    
    ### C) 구간 선택
    
    - “시작 메시지 ID”와 “끝 메시지 ID”를 확장 팝업 또는 페이지 내 UI에서 지정.
    - DOM 파싱 시 해당 범위(startId ~ endId) 내 메시지들만 필터링하여 파일로 변환.
    
    ---
    
    ## 4. 컨텍스트 크기 계산 (대화 기록 기준)
    
    ### 4-1. 기능 명세
    
    - 현재 대화가 **토큰 수**나 문자 수로 어느 정도 길이인지 실시간으로 계산 후 표시.
    - 모델별 최대 컨텍스트(예: GPT-4 최대 8K 토큰, GPT-3.5-turbo 최대 4K 토큰 등)에 근접하면 경고.
    - 시각적으로 사용 비율(%)을 프로그레스 바 등으로 표시.
    
    ### 4-2. 기술적 접근
    
    ### A) tiktoken 등 토큰화 라이브러리 활용
    
    - `tiktoken` npm 패키지를 브라우저(배포용)에서 사용할 수 있도록 WASM 번들 처리.
    - Content script에서 대화 메시지 합을 실시간으로 토크나이즈하여 토큰 수 계산.
    - (사용자가 입력 중일 때) 키 이벤트(debounce)로 입력창 내용의 토큰 수도 계산 가능.
    
    ### B) UI 구현
    
    - 계산된 “현재 토큰 수 / 모델 최대 토큰” 값으로 진행률(Progress Bar) 표시.
    - 토큰 한계에 근접하면 배지 색상 변경 또는 알림 띄우기.
    
    ---
    
    ## 5. 사용 패턴 분석 & 모델별 통계
    
    ### 5-1. 기능 명세
    
    - 사용자가 가장 많이 사용하는 시간대(피크 타임)와 메시지 빈도 그래프 제공.
    - 모델별 응답 시간(처리 속도) 통계, 기간별 사용량 추이(일간·주간·월간) 시각화.
    - Usage API(공식)나 직접 수집한 데이터(네트워크 가로채기)와 대조해 과금 기준/사용량 확인.
    
    ### 5-2. 기술적 접근
    
    ### A) 사용 데이터 수집
    
    - 메시지 전송 시각/모델 정보를 꾸준히 저장(배경 스크립트나 IndexedDB).
    - 필요 시 OpenAI의 Usage API(/v1/dashboard/billing/usage 등)에 대한 통신도 병행.
    
    ### B) 분석 및 시각화
    
    - 각 시간대(0~~23시), 요일(월~~일)별 메시지 건수 → 히트맵(heatmap)이나 막대그래프로 표현.
    - 모델별 응답 시간: 요청 시각과 응답 도착 시각을 기록해 평균응답시간 계산 → Chart.js 등 그래프 라이브러리로 표시.
    - 기간별(일/주/월) 사용량 누적 그래프: 메시지 or 토큰 기준으로 시계열 차트 작성.
    
    ---
    
    ## 전체 요약 및 구현 흐름
    
    1. **배경 스크립트(Background/Service Worker)**
        - `chrome.webRequest` 또는 `onHeadersReceived`를 활용해 ChatGPT API 및 Deep Research API 호출을 감시하고, 모델명·남은 횟수·사용 시간 등을 축적.
        - 일별/월별 카운트, 한도 임박 시 알림(Desktop Notifications) 기능도 여기서 실행.
    2. **콘텐츠 스크립트(Content Script)**
        - ChatGPT 페이지의 DOM에서 대화 메시지 파싱(대화 내보내기, 컨텍스트 계산에 활용).
        - 경우에 따라 `window.fetch`를 오버라이드하여 요청 파라미터(모델명 등) 직접 확인.
    3. **팝업(Popup.html / Popup.js)**
        - 모델별 사용량, 남은 한도, 딥리서치 잔여 횟수 등을 요약 표시.
        - 클릭 시 세부 통계 페이지(Options.html)로 이동하여 그래프나 상세 통계를 볼 수 있도록 구성.
    4. **토큰 계산 모듈(tiktoken 등)**
        - 대화 DOM(또는 사용자가 입력 중인 textarea)에서 텍스트를 추출해 실시간 토큰 수 계산.
        - 최대 토큰 수에 근접할 때 시각적 경고.
    5. **대화 내보내기 모듈**
        - DOM 파싱으로 얻은 메시지를 원하는 포맷(MD, TXT, JSON, PDF)으로 변환 후 `chrome.downloads.download` API로 저장.
        - 확장 UI에서 내보내기 옵션(포맷, 메시지 범위) 제공.
    
    이러한 구조로 확장을 구현하면, ChatGPT 사용량 모니터링(모델별), 딥리서치 쿼터 관리, 대화 기록 정리 등 요구사항을 대부분 만족시킬 수 있습니다.
    
    추가로 OpenAI Usage API 등을 통해 공식 과금 기준과 정확히 일치하는 사용량을 받아오면 보다 정밀한 관리도 가능하며, UI/UX 측면에서는 알림, 배지, 팝업, 브라우저 알람 등을 적절히 조합해 사용자에게 직관적으로 정보를 전달할 수 있습니다.
    
    > 참고 오픈소스 예시
    > 
    > - [napspans/chatGPT4-message-counter-ext](https://github.com/napspans/chatGPT4-message-counter-ext)
    > - [SpriteSixis/Token-Counter-for-ChatGPT](https://github.com/SpriteSixis/Token-Counter-for-ChatGPT)
    > - [rashidazarang/chatgpt-chat-exporter](https://github.com/rashidazarang/chatgpt-chat-exporter)
    > - [Chatterclock (Chrome Web Store)](https://chromewebstore.google.com/detail/chatterclock-%E2%80%94-a-chatgpt/mepflplnjbngmgakdefimlgbfpmhonoj)
    
    이상의 내용으로, 핵심 기능(① 모델별 카운트 & 한도 관리, ② 딥리서치 남은 횟수 추적, ③ 대화 기록 내보내기, ④ 컨텍스트 크기 계산, ⑤ 사용 패턴 분석)을 종합적으로 구현할 수 있습니다. 개별 기능에서 필요한 DOM 구조나 API 응답 형식이 변경될 수 있으므로, 배포 후에도 꾸준히 유지보수와 업데이트를 병행해야 합니다.
    
- 지시사항
    
    제공된 맥락들을 활용하여 ChatGPT 보조 도구 extension을 제작하시오