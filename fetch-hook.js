// fetch-hook.js — conversation API 가로채기 및 Deep Research/타임스탬프 수집
(() => {
  const PAGE_BRIDGE_CHANNEL = 'chatgpt-gurum-tool';
  const PAGE_BRIDGE_VERSION = 1;
  const MAX_PROMPT_SEGMENT_LENGTH = 100_000;
  const MAX_TIMESTAMP_MESSAGES = 50_000;
  const originalFetch = window.fetch;
  const convDetailRegex = new RegExp(
    '^https://(chat\\.openai|chatgpt)\\.com/backend-api/(?:[a-z-]+/)?conversation/[0-9a-fA-F-]+$',
  );
  const conversationSendRegex = /\/backend-api\/(?:[\w-]+\/)*conversation(?:$|\?|\/)/;

  const promptState = {
    toneDirective: null,
    promptText: null,
    includeTimestamp: false,
  };

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

  function sanitizePromptSegment(value) {
    if (typeof value !== 'string' || value.length > MAX_PROMPT_SEGMENT_LENGTH) return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  function sanitizeDeepResearchInfo(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.feature_name !== 'deep_research') return null;

    const remaining = Number(value.remaining);
    if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > 100_000) return null;

    const rawReset =
      typeof value.reset_after === 'string' && value.reset_after.length <= 128
        ? value.reset_after
        : typeof value.reset_after === 'number' && Number.isFinite(value.reset_after)
          ? value.reset_after
          : null;
    if (rawReset === null) return null;
    const normalizedReset =
      typeof rawReset === 'number' && rawReset < 1e11 ? rawReset * 1000 : rawReset;
    const resetMs = new Date(normalizedReset).getTime();
    if (
      !Number.isFinite(resetMs) ||
      resetMs < Date.UTC(2020, 0, 1) ||
      resetMs > Date.UTC(2100, 0, 1)
    ) {
      return null;
    }

    return {
      feature_name: 'deep_research',
      remaining,
      reset_after: new Date(resetMs).toISOString(),
    };
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!isPageBridgeMessage(data, 'GURUM_PROMPT_STATE')) return;
    const payload = data.payload || {};
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    promptState.toneDirective = sanitizePromptSegment(payload.toneDirective);
    promptState.promptText = sanitizePromptSegment(payload.promptText);
    promptState.includeTimestamp = payload.includeTimestamp === true;
  });

  function hasPromptSegments() {
    return (
      (promptState.toneDirective && promptState.toneDirective.trim()) ||
      (promptState.promptText && promptState.promptText.trim()) ||
      promptState.includeTimestamp
    );
  }

  function formatCurrentTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}`;

    const offsetMinutes = -now.getTimezoneOffset(); // minutes ahead of UTC
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const offsetHours = Math.floor(absMinutes / 60);
    const offsetRemainMinutes = absMinutes % 60;
    const offsetText = `UTC${sign}${pad(offsetHours)}:${pad(offsetRemainMinutes)}`;

    return `${localDate} (${offsetText})`;
  }

  function findMessagePartIndex(message) {
    if (!message || !message.content) return -1;
    const parts = Array.isArray(message.content.parts)
      ? message.content.parts
      : Array.isArray(message.content)
        ? message.content
        : null;
    if (!parts || !parts.length) return -1;
    if (message.content.content_type !== 'multimodal_text') {
      return 0;
    }
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (typeof part === 'string') return i;
      if (part && typeof part === 'object') {
        if (typeof part.text === 'string') return i;
        if (typeof part.content === 'string') return i;
        if (typeof part.value === 'string') return i;
      }
    }
    return -1;
  }

  function getMessagePartAccessor(message) {
    if (!message || !message.content) return null;
    const parts = Array.isArray(message.content.parts)
      ? message.content.parts
      : Array.isArray(message.content)
        ? message.content
        : null;
    if (!parts || !parts.length) return null;
    const index = findMessagePartIndex(message);
    if (index < 0 || index >= parts.length) return null;
    return {
      get() {
        const current = parts[index];
        if (typeof current === 'string') return current;
        if (current && typeof current.text === 'string') return current.text;
        if (current && typeof current.content === 'string') return current.content;
        if (current && typeof current.value === 'string') return current.value;
        return '';
      },
      set(value) {
        const current = parts[index];
        if (typeof current === 'string') {
          parts[index] = value;
        } else if (current && typeof current === 'object') {
          if (typeof current.text === 'string') current.text = value;
          else if (typeof current.content === 'string') current.content = value;
          else if (typeof current.value === 'string') current.value = value;
          else parts[index] = value;
        } else {
          parts[index] = value;
        }
      },
    };
  }

  function injectPromptSegments(payload) {
    if (!hasPromptSegments()) return false;
    if (!payload || !Array.isArray(payload.messages) || !payload.messages.length) return false;

    const accessor = getMessagePartAccessor(payload.messages[0]);
    if (!accessor) return false;

    const original = accessor.get();

    const tone = promptState.toneDirective ? promptState.toneDirective.trim() : '';
    const prompt = promptState.promptText ? promptState.promptText.trim() : '';
    const infoSegments = [];

    if (promptState.includeTimestamp) {
      infoSegments.push(`Current: ${formatCurrentTimestamp()}`);
    }
    if (tone) infoSegments.push(tone);
    if (prompt) infoSegments.push(prompt);

    if (!infoSegments.length) return false;

    const base = typeof original === 'string' ? original.trimStart() : '';
    const generatedBlock = `<info>\n//Generated automatically\n${infoSegments.join('\n')}\n</info>`;
    const segments = [generatedBlock];
    if (base) segments.push(base);
    const finalText = segments.join('\n');
    accessor.set(finalText);
    console.log(finalText);
    return true;
  }

  window.fetch = async function (input, init) {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input instanceof Request) url = input.url;
    else if (input && typeof input.url === 'string') url = input.url;

    let requestInfo = input;
    let requestInit = init;

    const isConversationInit = typeof url === 'string' && url.includes('/conversation/init');
    const isConversationDetail =
      (typeof url === 'string' && url.startsWith('/backend-api/conversation/')) ||
      (url && convDetailRegex.test(url));

    try {
      const targetForInjection =
        url && !isConversationDetail && !isConversationInit && conversationSendRegex.test(url);

      if (targetForInjection && hasPromptSegments()) {
        const baseInit = { ...(init || {}) };
        const requestObj = input instanceof Request ? input : null;

        if (requestObj) {
          if (baseInit.method == null && requestObj.method) baseInit.method = requestObj.method;
          if (baseInit.headers == null && requestObj.headers)
            baseInit.headers = new Headers(requestObj.headers);
          if (baseInit.credentials == null) baseInit.credentials = requestObj.credentials;
          if (baseInit.mode == null) baseInit.mode = requestObj.mode;
          if (baseInit.cache == null) baseInit.cache = requestObj.cache;
          if (baseInit.redirect == null) baseInit.redirect = requestObj.redirect;
          if (baseInit.referrer == null) baseInit.referrer = requestObj.referrer;
          if (baseInit.referrerPolicy == null) baseInit.referrerPolicy = requestObj.referrerPolicy;
          if (baseInit.integrity == null) baseInit.integrity = requestObj.integrity;
          if (baseInit.keepalive == null) baseInit.keepalive = requestObj.keepalive;
          if (baseInit.signal == null) baseInit.signal = requestObj.signal;
        }

        let method = baseInit.method || (requestObj && requestObj.method) || 'GET';
        method = typeof method === 'string' ? method.toUpperCase() : 'GET';

        if (method === 'POST') {
          let bodyText = typeof baseInit.body === 'string' ? baseInit.body : null;

          if (!bodyText && input instanceof Request) {
            try {
              bodyText = await input.clone().text();
              if (bodyText) baseInit.body = bodyText;
            } catch (_) {
              bodyText = null;
            }
          }

          if (typeof bodyText === 'string' && bodyText) {
            try {
              const payload = JSON.parse(bodyText);
              if (injectPromptSegments(payload)) {
                const newBody = JSON.stringify(payload);
                baseInit.body = newBody;
                baseInit.method = method;
                requestInfo = url;
                requestInit = baseInit;
              }
            } catch (error) {
              console.warn('대화 요청 파싱 중 오류:', error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('프롬프트 주입 준비 중 오류:', error);
    }

    const response = await originalFetch.call(this, requestInfo, requestInit);

    if (isConversationInit) {
      try {
        const cloned = response.clone();
        cloned
          .json()
          .then((data) => {
            if (data && Array.isArray(data.limits_progress)) {
              const deep = data.limits_progress.find((x) => x.feature_name === 'deep_research');
              const info = sanitizeDeepResearchInfo(deep);
              if (info) {
                window.postMessage(
                  createPageBridgeMessage('CHATGPT_TOOL_DEEP_RESEARCH_INFO', { info }),
                  '*',
                );
              }
            }
          })
          .catch(() => {});
      } catch (_) {}
    }

    if (isConversationDetail) {
      try {
        const cloned = response.clone();
        cloned
          .json()
          .then((data) => {
            try {
              const mapping =
                data && (data.mapping || (data.conversation && data.conversation.mapping));
              if (!mapping || typeof mapping !== 'object') return;
              const msgs = [];
              for (const key in mapping) {
                const m = mapping[key] && mapping[key].message;
                if (!m) continue;
                const id = m.id;
                const role = m.author && m.author.role;
                const ct = Number(m.create_time);
                if (
                  typeof id !== 'string' ||
                  id.length === 0 ||
                  id.length > 256 ||
                  (typeof role !== 'string' && role != null) ||
                  (typeof role === 'string' && role.length > 32) ||
                  !Number.isFinite(ct) ||
                  ct < 946684800 ||
                  ct > Date.now() / 1000 + 86400
                ) {
                  continue;
                }
                msgs.push({ id, role, create_time: ct });
                if (msgs.length >= MAX_TIMESTAMP_MESSAGES) break;
              }
              if (msgs.length) {
                window.postMessage(
                  createPageBridgeMessage('GURUM_TS_CONV_DATA', { messages: msgs }),
                  '*',
                );
              }
            } catch (e) {
              /* ignore */
            }
          })
          .catch(() => {});
      } catch (_) {}
    }

    return response;
  };
})();
