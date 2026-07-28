// fetch-hook.js — conversation API 가로채기 및 Deep Research/타임스탬프 수집
(() => {
  const PAGE_BRIDGE_CHANNEL = 'chatgpt-gurum-tool';
  const PAGE_BRIDGE_VERSION = 1;
  const MAX_PROMPT_SEGMENT_LENGTH = 100_000;
  const MAX_TIMESTAMP_MESSAGES = 50_000;
  const MAX_SNAPSHOT_DOM_MESSAGES = 2_000;
  const MAX_SNAPSHOT_DOM_TEXT_LENGTH = 5_000_000;
  const originalFetch = window.fetch;
  const CONVERSATION_SEND_PATH_PATTERN = /^\/backend-api\/(?:[\w-]+\/)*conversation\/?$/;
  const CONVERSATION_INIT_PATH_PATTERN = /^\/backend-api\/(?:[\w-]+\/)*conversation\/init\/?$/;
  const CONVERSATION_DETAIL_PATH_PATTERN =
    /^\/backend-api\/(?:[\w-]+\/)*conversation\/[0-9a-fA-F-]+\/?$/;

  const promptState = {
    toneDirective: null,
    promptText: null,
    includeTimestamp: false,
  };
  const snapshotBuilder = window.GurumConversationSnapshot || null;
  let conversationSnapshot = null;

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

    const remaining = Number(value.remaining ?? value.remaining_count ?? value.available);
    if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > 100_000) return null;

    const rawReset =
      typeof (value.reset_after ?? value.reset_at ?? value.resets_at) === 'string' &&
      (value.reset_after ?? value.reset_at ?? value.resets_at).length <= 128
        ? (value.reset_after ?? value.reset_at ?? value.resets_at)
        : typeof (value.reset_after ?? value.reset_at ?? value.resets_at) === 'number' &&
            Number.isFinite(value.reset_after ?? value.reset_at ?? value.resets_at)
          ? (value.reset_after ?? value.reset_at ?? value.resets_at)
          : null;
    let resetAfter;
    if (rawReset !== null) {
      const normalizedReset =
        typeof rawReset === 'number' && rawReset < 1e11 ? rawReset * 1000 : rawReset;
      const resetMs = new Date(normalizedReset).getTime();
      if (
        Number.isFinite(resetMs) &&
        resetMs >= Date.UTC(2020, 0, 1) &&
        resetMs <= Date.UTC(2100, 0, 1)
      ) {
        resetAfter = new Date(resetMs).toISOString();
      }
    }

    const info = {
      feature_name: 'deep_research',
      remaining,
    };
    if (resetAfter) info.reset_after = resetAfter;
    return info;
  }

  function sanitizeImageGenerationInfo(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!['image_gen', 'image_generation'].includes(value.feature_name)) return null;

    const remaining = Number(value.remaining ?? value.remaining_count ?? value.available);
    if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > 100_000) return null;

    const rawReset =
      typeof (value.reset_after ?? value.reset_at ?? value.resets_at) === 'string' &&
      (value.reset_after ?? value.reset_at ?? value.resets_at).length <= 128
        ? (value.reset_after ?? value.reset_at ?? value.resets_at)
        : typeof (value.reset_after ?? value.reset_at ?? value.resets_at) === 'number' &&
            Number.isFinite(value.reset_after ?? value.reset_at ?? value.resets_at)
          ? (value.reset_after ?? value.reset_at ?? value.resets_at)
          : null;
    let resetAfter;
    if (rawReset !== null) {
      const normalizedReset =
        typeof rawReset === 'number' && rawReset < 1e11 ? rawReset * 1000 : rawReset;
      const resetMs = new Date(normalizedReset).getTime();
      if (
        Number.isFinite(resetMs) &&
        resetMs >= Date.UTC(2020, 0, 1) &&
        resetMs <= Date.UTC(2100, 0, 1)
      ) {
        resetAfter = new Date(resetMs).toISOString();
      }
    }

    const info = {
      feature_name: 'image_gen',
      remaining,
    };
    if (resetAfter) info.reset_after = resetAfter;
    return info;
  }

  function findDeepResearchInfo(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    const wrappers = [data, data.usage, data.credits].filter(
      (value) => value && typeof value === 'object' && !Array.isArray(value),
    );
    const candidates = [];
    for (const wrapper of wrappers) {
      for (const key of ['limits_progress', 'features', 'limits']) {
        if (Array.isArray(wrapper[key])) candidates.push(...wrapper[key]);
      }
      for (const key of ['deep_research', 'deepResearch']) {
        const direct = wrapper[key];
        if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
          candidates.push({ ...direct, feature_name: 'deep_research' });
        }
      }
      if (wrapper.limits && typeof wrapper.limits === 'object' && !Array.isArray(wrapper.limits)) {
        const direct = wrapper.limits.deep_research ?? wrapper.limits.deepResearch;
        if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
          candidates.push({ ...direct, feature_name: 'deep_research' });
        }
      }
    }

    for (const candidate of candidates) {
      const info = sanitizeDeepResearchInfo(candidate);
      if (info) return info;
    }
    return null;
  }

  function findImageGenerationInfo(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    const wrappers = [data, data.usage, data.credits].filter(
      (value) => value && typeof value === 'object' && !Array.isArray(value),
    );
    const candidates = [];
    for (const wrapper of wrappers) {
      for (const key of ['limits_progress', 'features', 'limits']) {
        if (Array.isArray(wrapper[key])) candidates.push(...wrapper[key]);
      }
      for (const key of ['image_gen', 'image_generation', 'imageGeneration']) {
        const direct = wrapper[key];
        if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
          candidates.push({ ...direct, feature_name: 'image_gen' });
        }
      }
      if (wrapper.limits && typeof wrapper.limits === 'object' && !Array.isArray(wrapper.limits)) {
        const direct =
          wrapper.limits.image_gen ??
          wrapper.limits.image_generation ??
          wrapper.limits.imageGeneration;
        if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
          candidates.push({ ...direct, feature_name: 'image_gen' });
        }
      }
    }

    for (const candidate of candidates) {
      const info = sanitizeImageGenerationInfo(candidate);
      if (info) return info;
    }
    return null;
  }

  function getBackendApiPath(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.hostname !== 'chatgpt.com' && parsed.hostname !== 'chat.openai.com') return '';
      return parsed.pathname;
    } catch {
      return '';
    }
  }

  function isConversationSendUrl(url) {
    return CONVERSATION_SEND_PATH_PATTERN.test(getBackendApiPath(url));
  }

  function isConversationInitUrl(url) {
    return CONVERSATION_INIT_PATH_PATTERN.test(getBackendApiPath(url));
  }

  function isConversationDetailUrl(url) {
    return CONVERSATION_DETAIL_PATH_PATTERN.test(getBackendApiPath(url));
  }

  function sanitizeConversationId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
  }

  function getConversationIdFromUrl(url) {
    const path = getBackendApiPath(url);
    const match = path.match(/\/conversation\/([0-9a-fA-F-]+)\/?$/);
    return match ? sanitizeConversationId(match[1]) : null;
  }

  function sanitizeDomMessages(value) {
    if (!Array.isArray(value) || value.length > MAX_SNAPSHOT_DOM_MESSAGES) return [];
    const messages = [];
    let totalLength = 0;
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const id = sanitizeConversationId(item.id);
      const turnId = sanitizeConversationId(item.turnId);
      const sender = item.sender;
      const content = item.content;
      if (
        !id ||
        (sender !== 'user' && sender !== 'assistant') ||
        typeof content !== 'string' ||
        content.length > 500_000
      ) {
        continue;
      }
      totalLength += content.length;
      if (totalLength > MAX_SNAPSHOT_DOM_TEXT_LENGTH) break;
      messages.push({ id, turnId, sender, content });
    }
    return messages;
  }

  async function loadConversationSnapshot(conversationId) {
    if (
      !conversationId ||
      !snapshotBuilder ||
      typeof snapshotBuilder.buildConversationSnapshot !== 'function'
    ) {
      return null;
    }
    try {
      const response = await originalFetch.call(
        window,
        `/backend-api/conversation/${encodeURIComponent(conversationId)}`,
      );
      if (!response || response.ok === false) return null;
      const payload = await response.json();
      publishConversationTimestamps(payload);
      return snapshotBuilder.buildConversationSnapshot(payload, conversationId);
    } catch {
      return null;
    }
  }

  async function respondWithConversationSnapshot(data) {
    if (
      typeof data.requestId !== 'string' ||
      data.requestId.length === 0 ||
      data.requestId.length > 128
    ) {
      return;
    }
    const requestedConversationId = sanitizeConversationId(data.conversationId);
    let snapshot = conversationSnapshot;
    if (
      snapshot &&
      requestedConversationId &&
      snapshot.conversationId &&
      requestedConversationId !== snapshot.conversationId
    ) {
      snapshot = null;
    }
    if (!snapshot && requestedConversationId) {
      snapshot = await loadConversationSnapshot(requestedConversationId);
      if (snapshot) conversationSnapshot = snapshot;
    }
    if (snapshot && snapshotBuilder && typeof snapshotBuilder.mergeDomMessages === 'function') {
      snapshot = snapshotBuilder.mergeDomMessages(snapshot, sanitizeDomMessages(data.domMessages));
    }
    window.postMessage(
      createPageBridgeMessage('GURUM_CONVERSATION_SNAPSHOT_RESPONSE', {
        requestId: data.requestId,
        snapshot,
      }),
      '*',
    );
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (isPageBridgeMessage(data, 'GURUM_PROMPT_STATE')) {
      const payload = data.payload || {};
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
      promptState.toneDirective = sanitizePromptSegment(payload.toneDirective);
      promptState.promptText = sanitizePromptSegment(payload.promptText);
      promptState.includeTimestamp = payload.includeTimestamp === true;
      return;
    }
    if (isPageBridgeMessage(data, 'GURUM_CONVERSATION_SNAPSHOT_REQUEST')) {
      respondWithConversationSnapshot(data);
    }
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

  function publishConversationTimestamps(data) {
    try {
      const mapping = data && (data.mapping || (data.conversation && data.conversation.mapping));
      if (!mapping || typeof mapping !== 'object') return;
      const messages = [];
      for (const key in mapping) {
        const message = mapping[key] && mapping[key].message;
        if (!message) continue;
        const id = message.id;
        const role = message.author && message.author.role;
        const createTime = Number(message.create_time);
        if (
          typeof id !== 'string' ||
          id.length === 0 ||
          id.length > 256 ||
          (typeof role !== 'string' && role != null) ||
          (typeof role === 'string' && role.length > 32) ||
          !Number.isFinite(createTime) ||
          createTime < 946684800 ||
          createTime > Date.now() / 1000 + 86400
        ) {
          continue;
        }
        messages.push({ id, role, create_time: createTime });
        if (messages.length >= MAX_TIMESTAMP_MESSAGES) break;
      }
      if (messages.length) {
        window.postMessage(createPageBridgeMessage('GURUM_TS_CONV_DATA', { messages }), '*');
      }
    } catch {}
  }

  function getRequestMethod(input, init) {
    const method =
      init && init.method != null ? init.method : input instanceof Request && input.method;
    return typeof method === 'string' ? method.toUpperCase() : 'GET';
  }

  window.fetch = async function (input, init) {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input instanceof Request) url = input.url;
    else if (input && typeof input.url === 'string') url = input.url;

    let requestInfo = input;
    let requestInit = init;

    const isConversationInit = isConversationInitUrl(url);
    const isConversationDetail = isConversationDetailUrl(url);
    const originalMethod = getRequestMethod(input, init);

    try {
      const targetForInjection =
        url && !isConversationDetail && !isConversationInit && isConversationSendUrl(url);

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
            const deepResearchInfo = findDeepResearchInfo(data);
            if (deepResearchInfo) {
              window.postMessage(
                createPageBridgeMessage('CHATGPT_TOOL_DEEP_RESEARCH_INFO', {
                  info: deepResearchInfo,
                }),
                '*',
              );
            }
            const imageGenerationInfo = findImageGenerationInfo(data);
            if (imageGenerationInfo) {
              window.postMessage(
                createPageBridgeMessage('CHATGPT_TOOL_IMAGE_GENERATION_INFO', {
                  info: imageGenerationInfo,
                }),
                '*',
              );
            }
          })
          .catch(() => {});
      } catch (_) {}
    }

    if (isConversationDetail && originalMethod === 'GET') {
      conversationSnapshot = null;
      try {
        response
          .clone()
          .json()
          .then((data) => {
            publishConversationTimestamps(data);
            if (
              snapshotBuilder &&
              typeof snapshotBuilder.buildConversationSnapshot === 'function'
            ) {
              conversationSnapshot = snapshotBuilder.buildConversationSnapshot(
                data,
                getConversationIdFromUrl(url),
              );
            }
          })
          .catch(() => {});
      } catch (_) {}
    }

    return response;
  };
})();
