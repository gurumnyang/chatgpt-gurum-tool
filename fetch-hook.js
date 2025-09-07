// fetch-hook.js — 최소 구현: conversation/init 응답에서 Deep Research 정보만 읽기
(() => {
  const originalFetch = window.fetch;

  window.fetch = async function(input, init) {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input instanceof Request) url = input.url;
    else if (input && input.url) url = input.url;

    // 오직 conversation/init 응답만 확인
    if (url && url.includes('/conversation/init')) {
      try {
        const response = await originalFetch.apply(this, arguments);
        const cloned = response.clone();
        cloned.json().then(data => {
          if (data && Array.isArray(data.limits_progress)) {
            const deep = data.limits_progress.find(x => x.feature_name === 'deep_research');
            if (deep) {
              window.postMessage({ type: 'CHATGPT_TOOL_DEEP_RESEARCH_INFO', info: deep }, '*');
            }
          }
        }).catch(() => {});
        return response;
      } catch (e) {
        return originalFetch.apply(this, arguments);
      }
    }

    return originalFetch.apply(this, arguments);
  };
})();
