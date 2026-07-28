// ChatGPT conversation API 응답에서 DOM 가상화와 무관한 활성 대화 스냅샷을 만든다.
(() => {
  const MAX_MAPPING_NODES = 50_000;
  const MAX_TEXT_LENGTH = 5_000_000;
  const MAX_MESSAGE_TEXT_LENGTH = 500_000;
  const HIDDEN_CONTENT_TYPES = new Set([
    'computer_initialize_state',
    'model_editable_context',
    'reasoning_recap',
    'thoughts',
    'user_editable_context',
  ]);

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isValidId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 256;
  }

  function getConversationContainer(payload) {
    if (!isObject(payload)) return null;
    if (isObject(payload.mapping)) return payload;
    if (isObject(payload.conversation) && isObject(payload.conversation.mapping)) {
      return payload.conversation;
    }
    return null;
  }

  function collectActivePath(mapping, currentNodeId) {
    if (!isValidId(currentNodeId) || !isObject(mapping[currentNodeId])) return null;
    const reversed = [];
    const seen = new Set();
    let nodeId = currentNodeId;

    while (isValidId(nodeId) && isObject(mapping[nodeId])) {
      if (seen.has(nodeId) || reversed.length >= MAX_MAPPING_NODES) return null;
      seen.add(nodeId);
      reversed.push(nodeId);
      const parent = mapping[nodeId].parent;
      if (parent == null) break;
      if (!isValidId(parent)) return null;
      nodeId = parent;
    }

    if (!reversed.length) return null;
    const rootId = reversed[reversed.length - 1];
    if (mapping[rootId].parent != null) return null;
    return reversed.reverse();
  }

  function isVisibleConversationMessage(message) {
    if (!isObject(message)) return false;
    const role = message.author && message.author.role;
    if (role !== 'user' && role !== 'assistant') return false;

    const metadata = isObject(message.metadata) ? message.metadata : {};
    if (
      metadata.is_visually_hidden_from_conversation === true ||
      metadata.is_visually_hidden === true ||
      metadata.is_hidden === true ||
      metadata.hide_in_conversation === true
    ) {
      return false;
    }

    const contentType =
      isObject(message.content) && typeof message.content.content_type === 'string'
        ? message.content.content_type
        : '';
    if (HIDDEN_CONTENT_TYPES.has(contentType)) return false;

    const recipient = typeof message.recipient === 'string' ? message.recipient : '';
    if (role === 'assistant' && recipient && recipient !== 'all') return false;
    return true;
  }

  function appendText(value, parts, state, depth = 0) {
    if (state.overflow || value == null || depth > 5) return;
    if (typeof value === 'string') {
      if (state.length + value.length > MAX_MESSAGE_TEXT_LENGTH) {
        state.overflow = true;
        return;
      }
      state.length += value.length;
      parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) appendText(item, parts, state, depth + 1);
      return;
    }
    if (!isObject(value)) return;

    const imagePointer =
      typeof value.asset_pointer === 'string'
        ? value.asset_pointer
        : typeof value.image_url === 'string'
          ? value.image_url
          : null;
    if (imagePointer) {
      const alt =
        typeof value.alt_text === 'string'
          ? value.alt_text
          : typeof value.alt === 'string'
            ? value.alt
            : '';
      appendText(
        `${alt ? `[Image: ${alt}]` : '[Image]'}\n${imagePointer}`,
        parts,
        state,
        depth + 1,
      );
      return;
    }

    for (const key of ['text', 'content', 'value', 'result']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        appendText(value[key], parts, state, depth + 1);
        return;
      }
    }
  }

  function extractMessageText(message) {
    if (!isObject(message) || !message.content) return '';
    const content = message.content;
    const parts = [];
    const state = { length: 0, overflow: false };

    if (isObject(content) && Array.isArray(content.parts)) {
      appendText(content.parts, parts, state);
    } else if (Array.isArray(content)) {
      appendText(content, parts, state);
    } else if (typeof content === 'string') {
      appendText(content, parts, state);
    } else if (isObject(content)) {
      appendText(content.text ?? content.result ?? content.content, parts, state);
    }
    return state.overflow ? null : parts.filter(Boolean).join('\n');
  }

  function stripGeneratedPromptPrefix(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/^<info>\s*\n\/\/Generated automatically\n[\s\S]*?\n<\/info>\n?/, '');
  }

  function buildConversationSnapshot(payload, fallbackConversationId = null) {
    const container = getConversationContainer(payload);
    if (!container) return null;

    const mapping = container.mapping;
    const mappingSize = Object.keys(mapping).length;
    if (!mappingSize || mappingSize > MAX_MAPPING_NODES) return null;
    const activePath = collectActivePath(mapping, container.current_node);
    if (!activePath) return null;

    const conversationId =
      (isValidId(container.conversation_id) && container.conversation_id) ||
      (isValidId(payload.conversation_id) && payload.conversation_id) ||
      (isValidId(fallbackConversationId) && fallbackConversationId) ||
      null;
    const messages = [];
    const contextParts = [];
    let contextLength = 0;

    for (const nodeId of activePath) {
      const node = mapping[nodeId];
      const message = node && node.message;
      if (!isVisibleConversationMessage(message)) continue;
      const rawContent = extractMessageText(message);
      if (rawContent === null || !rawContent) continue;
      if (contextLength + rawContent.length > MAX_TEXT_LENGTH) return null;

      const messageId = isValidId(message.id) ? message.id : nodeId;
      const sender = message.author.role;
      const exportedContent =
        sender === 'user' ? stripGeneratedPromptPrefix(rawContent) : rawContent;
      if (!exportedContent) continue;

      messages.push({
        id: messageId,
        nodeId,
        sender,
        content: exportedContent,
        create_time: Number.isFinite(Number(message.create_time))
          ? Number(message.create_time)
          : null,
      });
      contextParts.push(rawContent);
      contextLength += rawContent.length;
    }

    if (!messages.length) return null;
    return {
      conversationId,
      messages,
      text: contextParts.join(''),
      chars: contextLength,
      messageCount: messages.length,
      lastMessageId: messages[messages.length - 1].id,
      lastNodeId: messages[messages.length - 1].nodeId,
    };
  }

  function mergeDomMessages(snapshot, domMessages) {
    if (!snapshot || !Array.isArray(snapshot.messages) || !Array.isArray(domMessages)) {
      return snapshot;
    }

    const knownIds = new Set();
    for (const message of snapshot.messages) {
      if (isValidId(message.id)) knownIds.add(message.id);
      if (isValidId(message.nodeId)) knownIds.add(message.nodeId);
    }

    let anchorIndex = -1;
    for (let index = 0; index < domMessages.length; index += 1) {
      const message = domMessages[index];
      if (
        message &&
        (knownIds.has(message.id) || (isValidId(message.turnId) && knownIds.has(message.turnId)))
      ) {
        anchorIndex = index;
      }
    }

    const candidates =
      anchorIndex >= 0
        ? domMessages.slice(anchorIndex + 1)
        : domMessages.filter(
            (message) =>
              message &&
              !knownIds.has(message.id) &&
              !(isValidId(message.turnId) && knownIds.has(message.turnId)),
          );
    if (!candidates.length) return snapshot;

    const messages = snapshot.messages.map((message) => ({ ...message }));
    let text = snapshot.text;
    let chars = snapshot.chars;
    for (const candidate of candidates) {
      if (
        !candidate ||
        !isValidId(candidate.id) ||
        (candidate.sender !== 'user' && candidate.sender !== 'assistant') ||
        typeof candidate.content !== 'string' ||
        !candidate.content ||
        candidate.content.length > MAX_MESSAGE_TEXT_LENGTH ||
        knownIds.has(candidate.id)
      ) {
        continue;
      }
      if (chars + candidate.content.length > MAX_TEXT_LENGTH) break;
      knownIds.add(candidate.id);
      if (isValidId(candidate.turnId)) knownIds.add(candidate.turnId);
      messages.push({
        id: candidate.id,
        nodeId: isValidId(candidate.turnId) ? candidate.turnId : candidate.id,
        sender: candidate.sender,
        content: candidate.content,
        create_time: null,
      });
      text += candidate.content;
      chars += candidate.content.length;
    }

    return {
      ...snapshot,
      messages,
      text,
      chars,
      messageCount: messages.length,
      lastMessageId: messages[messages.length - 1].id,
      lastNodeId: messages[messages.length - 1].nodeId,
    };
  }

  window.GurumConversationSnapshot = Object.freeze({
    buildConversationSnapshot,
    mergeDomMessages,
  });
})();
