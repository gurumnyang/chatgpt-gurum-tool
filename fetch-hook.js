// fetch-hook.js - fetch API를 후킹하여 conversation/init 요청을 가로채는 스크립트
(() => {
  // 원본 fetch 함수 저장
  const originalFetch = window.fetch;

  // fetch 함수를 오버라이드
  window.fetch = async function(input, init) {
    let url = '';
    
    // input이 Request 객체인 경우와 URL 문자열인 경우 처리
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else if (input && input.url) {
      url = input.url;
    }

    // conversation/init 요청 탐지
    if (url.includes('/conversation/init')) {
      console.log('📡 [Fetch Hook] conversation/init 요청 감지됨:', url);
      
      // 요청 본문 확인 시도
      if (init && init.body) {
        const body = init.body;
        
        // 문자열, Blob, FormData 등 다양한 형태의 body 처리
        try {
          if (typeof body === 'string') {
            try {
              const bodyObj = JSON.parse(body);
              console.log('📝 요청 본문(JSON):', bodyObj);
              
              // 메시지로 전달
              window.postMessage({
                type: 'CHATGPT_TOOL_INIT_REQUEST',
                url,
                body: bodyObj,
                keepalive: init.keepalive
              }, '*');
            } catch (e) {
              console.log('📝 요청 본문(문자열):', body);
            }
          } else if (body instanceof Blob) {
            // Blob은 비동기적으로 처리해야 함
            const clonedBlob = body.slice();
            clonedBlob.text().then(text => {
              try {
                const bodyObj = JSON.parse(text);
                console.log('📝 요청 본문(Blob JSON):', bodyObj);
                
                window.postMessage({
                  type: 'CHATGPT_TOOL_INIT_REQUEST',
                  url,
                  body: bodyObj,
                  keepalive: init.keepalive
                }, '*');
              } catch (e) {
                console.log('📝 요청 본문(Blob 텍스트):', text);
              }
            });
          } else if (body instanceof FormData) {
            const obj = {};
            for (const [key, val] of body.entries()) {
              obj[key] = val;
            }
            console.log('📝 요청 본문(FormData):', obj);
          } else if (body instanceof ReadableStream) {
            console.log('📝 요청 본문: ReadableStream (내용 확인 불가)');
          } else {
            console.log('📝 요청 본문(기타 타입):', body);
          }
        } catch (err) {
          console.warn('요청 본문 파싱 중 오류:', err);
        }
      }
      
      // 응답을 가로채서 분석
      try {
        const response = await originalFetch.apply(this, arguments);
        
        // 응답을 복제해서 본문을 읽고 원본은 그대로 반환
        const clonedResponse = response.clone();
        
        // 응답 본문 처리 (비동기)
        clonedResponse.json().then(data => {
          console.log('📥 [Fetch Hook] conversation/init 응답 본문:', data);
          
          // Deep Research 정보가 있는지 확인
          if (data && data.limits_progress) {
            const deepResearchInfo = data.limits_progress.find(
              item => item.feature_name === 'deep_research'
            );
            
            if (deepResearchInfo) {
              console.log('🔍 Deep Research 정보 발견:', deepResearchInfo);
              
              window.postMessage({
                type: 'CHATGPT_TOOL_DEEP_RESEARCH_INFO',
                info: deepResearchInfo
              }, '*');
            }
          }
        }).catch(err => {
          console.warn('응답 본문 파싱 중 오류:', err);
        });
        
        return response;
      } catch (error) {
        console.error('fetch 후킹 중 오류:', error);
        // 오류 발생 시 원본 fetch로 폴백
        return originalFetch.apply(this, arguments);
      }
    }
    
    // conversation/init 요청이 아닌 경우 원본 fetch 함수 호출
    return originalFetch.apply(this, arguments);
  };

  console.log('✅ [fetch 후킹 성공] API 요청 모니터링 중...');
})();
