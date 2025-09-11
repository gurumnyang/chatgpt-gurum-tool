// fetch-hook.js — 최소 구현: conversation/init 응답에서 Deep Research 정보만 읽기
(() => {
  const originalFetch = window.fetch;
  const convDetailRegex = new RegExp("^https://(chat\\.openai|chatgpt)\\.com/backend-api/conversation/[0-9a-fA-F-]+$");

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

    // 대화 상세(히스토리) 페치 시 메시지 타임스탬프 수집
    if (url && convDetailRegex.test(url)) {
      try {
        const response = await originalFetch.apply(this, arguments);
        const cloned = response.clone();
        cloned.json().then(data => {
          try {
            const mapping = data && (data.mapping || (data.conversation && data.conversation.mapping));
            if (!mapping || typeof mapping !== 'object') return;
            const msgs = [];
            for (const key in mapping) {
              const m = mapping[key] && mapping[key].message;
              if (!m) continue;
              const id = m.id;
              const role = m.author && m.author.role;
              const ct = Number(m.create_time);
              if (!id || !ct) continue;
              msgs.push({ id, role, create_time: ct });
            }
            if (msgs.length) {
              window.postMessage({ type: 'GURUM_TS_CONV_DATA', messages: msgs }, '*');
            }
          } catch (e) { /* ignore */ }
        }).catch(() => {});
        return response;
      } catch (e) {
        return originalFetch.apply(this, arguments);
      }
    }

    return originalFetch.apply(this, arguments);
  };
})();
