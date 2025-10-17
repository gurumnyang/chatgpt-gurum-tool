(() => {
  const HOVER_TOOLBAR_ID = 'gurum-hover-toolbar';
  const HOVER_TOOLBAR_STYLE_ID = 'gurum-hover-toolbar-style';
  const HOVER_THEME_STORAGE_KEY = 'popupTheme';
  const HOVER_STORAGE_KEYS = {
    tone: 'hoverToolbarTone',
    timestamp: 'hoverToolbarIncludeTimestamp',
    enabled: 'hoverToolbarEnabled',
  };
  const TONE_PRESET_STORAGE_KEY = 'hoverTonePresets';

  const DEFAULT_TONE_PRESETS = [
    { id: 'neutral', label: '기본', prompt: '' },
    {
      id: 'friendly',
      label: '친근',
      prompt: '따뜻하고 우호적인 느낌을 주는 톤',
    },
    {
      id: 'polite',
      label: '격식',
      prompt: '정중하고 격식 있는 문체',
    },
    {
      id: 'monday',
      label: '비관적',
      prompt: '비관적이고 회의적인 톤',
    },
    {
      id: 'dcinside',
      label: '디시',
      prompt: '디시인사이드의 천박한 말투. 거칠고 직설적임.',
    },
  ];
  let tonePresets = DEFAULT_TONE_PRESETS.map((preset) => ({ ...preset }));

  const HOVER_CUSTOM_PROMPTS = [
    {
      id: 'summary',
      label: '요약 지시',
      text: '아래 내용을 5개의 핵심 bullet으로 요약해줘.',
    },
    {
      id: 'checker',
      label: '품질 점검',
      text: '답변이 논리적으로 타당한지 검증하고, 필요한 보완점을 제안해줘.',
    },
    {
      id: 'steps',
      label: '단계별 안내',
      text: '해결 절차를 단계별로 나눠 번호 목록으로 설명해줘.',
    },
  ];

  const TIMESTAMP_PRESETS = [
    //이거 바꾸지 마세요
    { id: 'include', label: '켜짐', value: true },
    { id: 'exclude', label: '꺼짐', value: false },
  ];

  const HOVER_TOOLBAR_STYLE = `

    /* 채팅창 패딩 무력화ㅡ툴바때문에 여백이 늘어나는거 방지 */
    .pb-25 {
      padding-bottom: 0 !important;
      }
    #${HOVER_TOOLBAR_ID} {
      contain: layout;
      width: 100%;
      display: flex;
      justify-content: stretch;
      margin-bottom: 8px;
      position: relative;
      z-index: 9998;
    }

    #${HOVER_TOOLBAR_ID} .gurum-inline-groups {
      --control-bg: rgba(248, 249, 250, 0.95);
      --control-border: rgba(223, 227, 232, 0.85);
      --control-hover-bg: rgba(0, 120, 212, 0.12);
      --control-hover-border: rgba(0, 120, 212, 0.45);
      --control-hover-text: #0b5ed7;
      --body-text: #343a40;
      --label-color: #6c757d;
      --dropdown-bg: #ffffff;
      --dropdown-border: #dee2e6;
      --dropdown-shadow: 0 16px 38px rgba(15, 23, 42, 0.18);
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      box-sizing: border-box;
      padding: 4px 4px 8px;
      color: var(--body-text);
      background: transparent;
    }

    #${HOVER_TOOLBAR_ID}[data-theme='dark'] .gurum-inline-groups {
      --control-bg: rgba(30, 36, 48, 0.92);
      --control-border: rgba(56, 63, 80, 0.75);
      --control-hover-bg: rgba(192, 132, 252, 0.22);
      --control-hover-border: rgba(192, 132, 252, 0.48);
      --control-hover-text: #f3e8ff;
      --body-text: #e8e8e8;
      --label-color: #9aa4b2;
      --dropdown-bg: #181b20;
      --dropdown-border: #2a2e34;
      --dropdown-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
    }

    #${HOVER_TOOLBAR_ID}[data-theme='rabbit'] .gurum-inline-groups {
      --control-bg: rgba(255, 240, 246, 0.95);
      --control-border: rgba(255, 214, 231, 0.85);
      --control-hover-bg: rgba(255, 118, 173, 0.2);
      --control-hover-border: rgba(255, 118, 173, 0.45);
      --control-hover-text: #be185d;
      --body-text: #5b4b5b;
      --label-color: #b38aa6;
      --dropdown-bg: #ffffff;
      --dropdown-border: #ffd6e7;
      --dropdown-shadow: 0 18px 32px rgba(255, 118, 173, 0.24);
    }

    #${HOVER_TOOLBAR_ID}[data-theme='cat'] .gurum-inline-groups {
      --control-bg: rgba(24, 30, 48, 0.92);
      --control-border: rgba(40, 52, 78, 0.75);
      --control-hover-bg: rgba(125, 211, 252, 0.22);
      --control-hover-border: rgba(125, 211, 252, 0.5);
      --control-hover-text: #e8ecf4;
      --body-text: #e8ecf4;
      --label-color: #93a4c4;
      --dropdown-bg: #151a2c;
      --dropdown-border: #26304a;
      --dropdown-shadow: 0 20px 42px rgba(13, 20, 38, 0.6);
    }

    #${HOVER_TOOLBAR_ID} .gurum-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 100px;
      flex: 1 1 0;
    }

    #${HOVER_TOOLBAR_ID} .gurum-section--tone,
    #${HOVER_TOOLBAR_ID} .gurum-section--timestamp {
      flex: 0 0 80px;
      min-width: 80px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-section--prompt {
      flex: 0 0 150px;
      min-width: 150px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      margin-left: auto;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-button {
      width: 25px;
      height: 25px;
      border-radius: 50%;
      border: 1px solid var(--control-border);
      background: var(--control-bg);
      color: var(--body-text);
      font-size: 16px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.18s ease, border 0.18s ease, color 0.18s ease, transform 0.18s ease;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-button:hover,
    #${HOVER_TOOLBAR_ID} .gurum-info-button:focus {
      background: var(--control-hover-bg);
      border-color: var(--control-hover-border);
      color: var(--control-hover-text);
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-button:focus-visible {
      outline: 2px solid var(--control-hover-border);
      outline-offset: 2px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-tooltip {
      position: absolute;
      top: calc(100%);
      right: -10px;
      width: min(260px, 70vw);
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--dropdown-bg);
      border: 1px solid var(--dropdown-border);
      box-shadow: var(--dropdown-shadow);
      font-size: 13px;
      line-height: 1.4;
      color: var(--body-text);
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 10001;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-tooltip strong {
      display: block;
      margin-bottom: 4px;
      color: var(--control-hover-text);
      font-size: 13px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-tooltip a {
      display: inline-block;
      margin-top: 6px;
      font-size: 12px;
      color: var(--label-color);
      text-decoration: underline;
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-tooltip a:hover {
      color: var(--control-hover-text);
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-tooltip::before {
      content: '';
      position: absolute;
      top: -7px;
      right: 16px;
      width: 12px;
      height: 12px;
      background: inherit;
      border-left: 1px solid var(--dropdown-border);
      border-top: 1px solid var(--dropdown-border);
      transform: rotate(45deg);
    }

    #${HOVER_TOOLBAR_ID} .gurum-info-wrapper[data-open='true'] .gurum-info-tooltip {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    #${HOVER_TOOLBAR_ID} .gurum-section-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--label-color);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown {
      position: relative;
      display: flex;
      align-items: center;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown-trigger {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 999px;
      background: var(--control-bg);
      border: 1px solid var(--control-border);
      color: var(--body-text);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.18s ease, border 0.18s ease, color 0.18s ease;
      white-space: nowrap;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='tone'] .gurum-dropdown-trigger {
      width: 100px;
      min-width: 100px;
      max-width: 130px;
      padding: 8px 12px;
    }
    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='timestamp'] .gurum-dropdown-trigger {
      width: 80px;
      min-width: 80px;
      max-width: 100px;
      padding: 8px 12px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='prompt'] .gurum-dropdown-trigger {
      width: 150px;
      min-width: 150px;
      max-width: 150px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-open='true'] .gurum-dropdown-trigger,
    #${HOVER_TOOLBAR_ID} .gurum-dropdown-trigger:hover {
      background: var(--control-hover-bg);
      border-color: var(--control-hover-border);
      color: var(--control-hover-text);
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown-value {
      flex: 1;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown-caret {
      font-size: 11px;
      color: inherit;
      transition: transform 0.18s ease;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-open='true'] .gurum-dropdown-caret {
      transform: rotate(180deg);
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown-panel {
      position: absolute;
      top: calc(100% + 8px);
      min-width: 220px;
      max-width: 320px;
      width: max-content;
      max-height: min(280px, 70vh);
      padding: 10px;
      border-radius: 14px;
      background: var(--dropdown-bg);
      border: 1px solid var(--dropdown-border);
      box-shadow: var(--dropdown-shadow);
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 10000;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='tone'] .gurum-dropdown-panel,
    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='timestamp'] .gurum-dropdown-panel {
      min-width: 140px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='prompt'] .gurum-dropdown-panel {
      min-width: 220px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-open='true'] .gurum-dropdown-panel {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown-panel::before {
      content: '';
      position: absolute;
      top: -7px;
      left: 32px;
      width: 12px;
      height: 12px;
      background: inherit;
      border-left: 1px solid var(--dropdown-border);
      border-top: 1px solid var(--dropdown-border);
      transform: rotate(45deg);
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-placement='top'] .gurum-dropdown-panel {
      top: auto;
      bottom: calc(100% + 8px);
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-placement='top'] .gurum-dropdown-panel::before {
      top: auto;
      bottom: -7px;
      transform: rotate(225deg);
    }

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-align='right'] .gurum-dropdown-panel::before {
      left: auto;
      right: 32px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-options,
    #${HOVER_TOOLBAR_ID} .gurum-prompt-list {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    #${HOVER_TOOLBAR_ID} .gurum-prompt-list {
      gap: 6px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-options {
      gap: 0;
      max-height: 220px;
      overflow-y: auto;
      padding: 4px 0;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-empty {
      font-size: 12px;
      color: var(--label-color);
      padding: 12px 8px;
      text-align: center;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-options::-webkit-scrollbar {
      width: 6px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-options::-webkit-scrollbar-thumb {
      background: rgba(108, 117, 125, 0.35);
      border-radius: 999px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-button,
    #${HOVER_TOOLBAR_ID} .gurum-prompt-button,
    #${HOVER_TOOLBAR_ID} .gurum-prompt-clear {
      padding: 6px 12px;
      border-radius: 12px;
      border: 1px solid var(--control-border);
      background: var(--control-bg);
      color: var(--body-text);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      width: 100%;
      justify-content: flex-start;
      transition: background 0.18s ease, border 0.18s ease, color 0.18s ease;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-button[data-active='true'],
    #${HOVER_TOOLBAR_ID} .gurum-prompt-button[data-active='true'],
    #${HOVER_TOOLBAR_ID} .gurum-prompt-clear[data-active='true'] {
      background: var(--control-hover-bg);
      border-color: var(--control-hover-border);
      color: var(--control-hover-text);
    }

    #${HOVER_TOOLBAR_ID} .gurum-prompt-button:hover,
    #${HOVER_TOOLBAR_ID} .gurum-tone-button:hover,
    #${HOVER_TOOLBAR_ID} .gurum-prompt-clear:hover {
      background: var(--control-hover-bg);
      border-color: var(--control-hover-border);
      color: var(--control-hover-text);
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-options .gurum-tone-button {
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      margin: 0;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-options .gurum-tone-button + .gurum-tone-button {
      margin-top: 2px;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-manage-row {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--dropdown-border);
      display: flex;
      justify-content: flex-end;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-manage {
      background: none;
      border: none;
      color: var(--label-color);
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    #${HOVER_TOOLBAR_ID} .gurum-tone-manage:hover,
    #${HOVER_TOOLBAR_ID} .gurum-tone-manage:focus {
      color: var(--control-hover-text);
    }

    .gurum-tone-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10010;
    }

    .gurum-tone-modal {
      width: min(460px, 90vw);
      max-height: min(520px, 92vh);
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      background: #ffffff;
      color: #212529;
      box-shadow: 0 20px 48px rgba(15, 23, 42, 0.28);
      overflow: hidden;
    }

    .gurum-tone-modal[data-theme='dark'] {
      background: #1e2533;
      color: #e9ecef;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6);
    }

    .gurum-tone-modal-header {
      padding: 18px 20px 12px;
      font-size: 16px;
      font-weight: 600;
    }

    .gurum-tone-modal-body {
      padding: 0 20px 20px;
      overflow-y: auto;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .gurum-tone-modal-body::-webkit-scrollbar {
      width: 6px;
    }

    .gurum-tone-modal-body::-webkit-scrollbar-thumb {
      background: rgba(108, 117, 125, 0.35);
      border-radius: 999px;
    }

    .gurum-tone-row {
      border: 1px solid rgba(222, 227, 232, 0.6);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: rgba(248, 249, 250, 0.45);
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-row {
      border-color: rgba(56, 63, 80, 0.8);
      background: rgba(30, 36, 48, 0.6);
    }

    .gurum-tone-row-fields {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .gurum-tone-input,
    .gurum-tone-textarea {
      width: 100%;
      border-radius: 8px;
      border: 1px solid rgba(206, 212, 218, 0.9);
      padding: 8px 10px;
      font-size: 13px;
      box-sizing: border-box;
      background: #ffffff;
      color: inherit;
    }

    .gurum-tone-textarea {
      min-height: 64px;
      resize: vertical;
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-input,
    .gurum-tone-modal[data-theme='dark'] .gurum-tone-textarea {
      background: rgba(24, 30, 48, 0.9);
      border-color: rgba(64, 74, 96, 0.9);
      color: #f1f5f9;
    }

    .gurum-tone-input.is-error,
    .gurum-tone-textarea.is-error {
      border-color: #dc3545;
      box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.15);
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-input.is-error,
    .gurum-tone-modal[data-theme='dark'] .gurum-tone-textarea.is-error {
      border-color: #f87171;
      box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.22);
    }

    .gurum-tone-row-actions {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .gurum-tone-delete {
      background: none;
      border: none;
      color: #dc3545;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
    }

    .gurum-tone-reorder {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .gurum-tone-move {
      background: none;
      border: none;
      color: #0b5ed7;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-move {
      color: #60a5fa;
    }

    .gurum-tone-move:disabled {
      color: rgba(108, 117, 125, 0.4);
      cursor: not-allowed;
    }

    .gurum-tone-delete:disabled {
      color: rgba(220, 53, 69, 0.4);
      cursor: not-allowed;
    }

    .gurum-tone-modal-footer {
      padding: 12px 20px 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-top: 1px solid rgba(222, 227, 232, 0.5);
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-modal-footer {
      border-top-color: rgba(56, 63, 80, 0.7);
    }

    .gurum-tone-secondary,
    .gurum-tone-primary,
    .gurum-tone-add {
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      border: none;
    }

    .gurum-tone-secondary {
      background: rgba(222, 227, 232, 0.6);
      color: #495057;
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-secondary {
      background: rgba(56, 63, 80, 0.85);
      color: #e2e8f0;
    }

    .gurum-tone-primary {
      background: #0b5ed7;
      color: #ffffff;
    }

    .gurum-tone-add {
      background: rgba(12, 110, 253, 0.12);
      color: #0b5ed7;
    }

    .gurum-tone-modal[data-theme='dark'] .gurum-tone-add {
      background: rgba(96, 165, 250, 0.18);
      color: #60a5fa;
    }
  `;

  function cloneDefaultTonePresets() {
    return DEFAULT_TONE_PRESETS.map((preset) => ({ ...preset }));
  }

  function generateTonePresetId() {
    return `tone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function sanitizeTonePresetList(list) {
    if (!Array.isArray(list)) return cloneDefaultTonePresets();
    const sanitized = [];
    const seen = new Set();
    list.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : null;
      if (!id) {
        id = generateTonePresetId();
      }
      if (seen.has(id)) {
        id = `${id}-${index}-${Math.random().toString(36).slice(2, 5)}`;
      }
      seen.add(id);
      const label =
        typeof item.label === 'string' && item.label.trim()
          ? item.label.trim()
          : `프리셋 ${sanitized.length + 1}`;
      const prompt =
        typeof item.prompt === 'string'
          ? item.prompt.replace(/^\s*tone\s*:\s*/i, '').trim()
          : '';
      sanitized.push({ id, label, prompt });
    });
    if (!sanitized.length) {
      return cloneDefaultTonePresets();
    }
    return sanitized;
  }

  function getTonePresetById(id) {
    if (!id) return null;
    return tonePresets.find((item) => item.id === id) || null;
  }

  const hoverToolbarState = {
    tone: 'neutral',
    includeTimestamp: false,
    selectedPromptId: null,
    theme: 'light',
    enabled: true,
    composerEl: null,
    observer: null,
    checkTimer: null,
    initRequested: false,
    statusTimer: null,
    elements: null,
    dropdowns: [],
    toneModal: null,
    toneModalEscHandler: null,
    lastSegments: {
      tone: null,
      prompt: null,
      timestamp: null,
    },
    lastBroadcastPayload: null,
  };
  const DROPDOWN_MAX_HEIGHT = 280;

  function getTonePresets() {
    return tonePresets.slice();
  }

  function refreshToneOptionsUI() {
    const refreshFn = hoverToolbarState.elements?.toneOptionsRefresh;
    if (typeof refreshFn === 'function') {
      refreshFn();
    }
  }

  function ensureToneSelection(preferredId) {
    const available = tonePresets;
    let nextTone = hoverToolbarState.tone;
    if (preferredId && available.some((item) => item.id === preferredId)) {
      nextTone = preferredId;
    } else if (!available.some((item) => item.id === nextTone)) {
      nextTone = available.length ? available[0].id : null;
    }
    const changed = hoverToolbarState.tone !== nextTone;
    hoverToolbarState.tone = nextTone;
    return changed;
  }

  function setTonePresets(list, { persist = false, preferredId, silent = false } = {}) {
    tonePresets = sanitizeTonePresetList(list);
    const selectionChanged = ensureToneSelection(preferredId);
    if (persist && chrome?.storage?.local) {
      chrome.storage.local.set({ [TONE_PRESET_STORAGE_KEY]: tonePresets });
    }
    refreshToneOptionsUI();
    syncHoverToolbarUI();
    if (selectionChanged) {
      persistHoverToolbarState();
    }
    if (!silent) {
      clearLastSegments('tone');
      broadcastPromptInjectionState(true);
    }
  }

  function injectHoverToolbarStyles() {
    if (document.getElementById(HOVER_TOOLBAR_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HOVER_TOOLBAR_STYLE_ID;
    style.textContent = HOVER_TOOLBAR_STYLE;
    document.documentElement.appendChild(style);
  }

  function tryLoadHoverToolbarPrefs(onReady) {
    if (!chrome?.storage?.local) {
      if (typeof onReady === 'function') onReady();
      return;
    }
    const keys = [
      HOVER_STORAGE_KEYS.tone,
      HOVER_STORAGE_KEYS.timestamp,
      HOVER_THEME_STORAGE_KEY,
      HOVER_STORAGE_KEYS.enabled,
      TONE_PRESET_STORAGE_KEY,
    ];
    chrome.storage.local.get(keys, (res) => {
      try {
        const storedTone =
          res && typeof res[HOVER_STORAGE_KEYS.tone] === 'string'
            ? res[HOVER_STORAGE_KEYS.tone]
            : null;
        const storedPresets = res && res[TONE_PRESET_STORAGE_KEY];
        if (Array.isArray(storedPresets)) {
          setTonePresets(storedPresets, { silent: true, preferredId: storedTone });
        } else if (storedTone) {
          ensureToneSelection(storedTone);
        }
        if (res && typeof res[HOVER_STORAGE_KEYS.timestamp] === 'boolean') {
          hoverToolbarState.includeTimestamp = res[HOVER_STORAGE_KEYS.timestamp];
        }
        if (res && typeof res[HOVER_THEME_STORAGE_KEY] === 'string') {
          applyHoverToolbarTheme(res[HOVER_THEME_STORAGE_KEY]);
        }
        if (res && typeof res[HOVER_STORAGE_KEYS.enabled] === 'boolean') {
          hoverToolbarState.enabled = res[HOVER_STORAGE_KEYS.enabled];
        }
      } catch (e) {
        console.warn('호버 툴바 설정 로드 실패:', e);
      } finally {
        if (typeof onReady === 'function') onReady();
      }
    });
  }

  function initializeHoverToolbar() {
    if (hoverToolbarState.initRequested) return;
    hoverToolbarState.initRequested = true;
    injectHoverToolbarStyles();
    tryLoadHoverToolbarPrefs(() => {
      scheduleHoverToolbarCheck();
      startComposerObserver();
      broadcastPromptInjectionState(true);
    });
  }

  function normalizeHoverTheme(theme) {
    const allowed = ['light', 'dark', 'rabbit', 'cat'];
    if (!theme || typeof theme !== 'string') return 'light';
    return allowed.includes(theme) ? theme : 'light';
  }

  function applyHoverToolbarTheme(theme) {
    const normalized = normalizeHoverTheme(theme);
    if (hoverToolbarState.theme === normalized) return;
    hoverToolbarState.theme = normalized;
    syncHoverToolbarUI();
  }

  function startComposerObserver() {
    if (hoverToolbarState.observer || !document.body) return;
    hoverToolbarState.observer = new MutationObserver(() => {
      scheduleHoverToolbarCheck();
    });
    hoverToolbarState.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function scheduleHoverToolbarCheck() {
    if (hoverToolbarState.checkTimer) return;
    hoverToolbarState.checkTimer = setTimeout(() => {
      hoverToolbarState.checkTimer = null;
      attachHoverToolbarIfNeeded();
    }, 200);
  }

  function attachHoverToolbarIfNeeded() {
    if (!hoverToolbarState.enabled) {
      cleanupHoverToolbarElements();
      hoverToolbarState.composerEl = null;
      return;
    }
    const composer = findComposerWrapper();
    const existing = document.getElementById(HOVER_TOOLBAR_ID);

    if (!composer) {
      if (existing) existing.remove();
      cleanupHoverToolbarElements();
      hoverToolbarState.composerEl = null;
      return;
    }

    if (hoverToolbarState.composerEl === composer && existing) {
      return;
    }

    cleanupHoverToolbarElements();

    const parent = composer.parentElement;
    if (!parent) return;

    const { container, refs } = createHoverToolbarElement();

    parent.insertBefore(container, composer);

    hoverToolbarState.composerEl = composer;
    hoverToolbarState.elements = refs;
    syncHoverToolbarUI();
  }

  function cleanupHoverToolbarElements() {
    if (!hoverToolbarState.elements) return;
    try {
      const handlers = hoverToolbarState.elements.documentHandlers;
      if (Array.isArray(handlers)) {
        handlers.forEach(({ type, fn }) => {
          if (type && typeof fn === 'function') {
            document.removeEventListener(type, fn);
          }
        });
      }
      const root = hoverToolbarState.elements.root;
      if (root?.parentElement) {
        root.parentElement.removeChild(root);
      }
    } catch (e) {
      console.warn('호버 툴바 정리 중 오류:', e);
    }
    hoverToolbarState.elements = null;
    hoverToolbarState.dropdowns = [];
  }

  function getToneLabel(toneId) {
    if (!toneId) return '설정 안 함';
    const preset = getTonePresetById(toneId);
    return preset ? preset.label : toneId;
  }

  function getPromptById(id) {
    if (!id) return null;
    return HOVER_CUSTOM_PROMPTS.find((item) => item.id === id) || null;
  }

  function getPromptLabel(id) {
    const preset = getPromptById(id);
    if (preset) return preset.label;
    return '선택 안 함';
  }

  function getSelectedPromptText() {
    const preset = getPromptById(hoverToolbarState.selectedPromptId);
    return preset ? preset.text : null;
  }

  function getTimestampLabel(include) {
    const preset = TIMESTAMP_PRESETS.find((item) => item.value === include);
    return preset ? preset.label : '';
  }

  function clearLastSegments(keys) {
    if (!hoverToolbarState.lastSegments) {
      hoverToolbarState.lastSegments = { tone: null, prompt: null, timestamp: null };
    }
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(hoverToolbarState.lastSegments, key)) {
        hoverToolbarState.lastSegments[key] = null;
      }
    });
  }

  function getPromptInjectionState() {
    const toneDirective = buildToneDirectiveText() || null;
    const promptText = getSelectedPromptText();
    if (!hoverToolbarState.enabled) {
      return {
        toneDirective: null,
        promptText: null,
        includeTimestamp: false,
      };
    }
    return {
      toneDirective: toneDirective || null,
      promptText: promptText || null,
      includeTimestamp: !!hoverToolbarState.includeTimestamp,
    };
  }

  function broadcastPromptInjectionState(force = false) {
    try {
      const payload = getPromptInjectionState();
      const prev = hoverToolbarState.lastBroadcastPayload;
      if (
        !force &&
        prev &&
        prev.toneDirective === payload.toneDirective &&
        prev.promptText === payload.promptText &&
        prev.includeTimestamp === payload.includeTimestamp
      ) {
        return;
      }
      hoverToolbarState.lastBroadcastPayload = { ...payload };
      window.postMessage({ type: 'GURUM_PROMPT_STATE', payload }, '*');
    } catch (error) {
      console.warn('프롬프트 상태 브로드캐스트 실패:', error);
    }
  }

  function setDropdownOpen(dropdownEl, open) {
    if (!dropdownEl) return;
    dropdownEl.setAttribute('data-open', open ? 'true' : 'false');
    if (open) {
      requestAnimationFrame(() => positionDropdownPanel(dropdownEl));
    }
  }

  function closeAllDropdowns(except) {
    if (!Array.isArray(hoverToolbarState.dropdowns)) return;
    hoverToolbarState.dropdowns.forEach((dropdownEl) => {
      if (dropdownEl && dropdownEl !== except) {
        setDropdownOpen(dropdownEl, false);
      }
    });
  }

  function positionDropdownPanel(dropdownEl) {
    const trigger = dropdownEl.querySelector('.gurum-dropdown-trigger');
    const panel = dropdownEl.querySelector('.gurum-dropdown-panel');
    if (!trigger || !panel) return;

    const type = dropdownEl.dataset.dropdownType || 'default';
    const triggerRect = trigger.getBoundingClientRect();

    let baseMin = 180;
    let baseMax = 320;
    if (type === 'tone') {
      baseMin = 120;
      baseMax = 200;
    } else if (type === 'timestamp') {
      baseMin = 100;
      baseMax = 200;
    } else if (type === 'prompt') {
      baseMin = 220;
      baseMax = 320;
    }
    const desiredMinWidth = Math.max(baseMin, Math.ceil(triggerRect.width));
    panel.style.minWidth = `${Math.min(desiredMinWidth, baseMax)}px`;
    panel.style.maxHeight = `${Math.min(DROPDOWN_MAX_HEIGHT, Math.floor(window.innerHeight * 0.7))}px`;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const estimatedHeight = Math.min(panel.scrollHeight, DROPDOWN_MAX_HEIGHT) + 16;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      panel.style.top = '';
      panel.style.bottom = `calc(100% + 8px)`;
      dropdownEl.dataset.dropdownPlacement = 'top';
    } else {
      panel.style.top = `calc(100% + 8px)`;
      panel.style.bottom = '';
      dropdownEl.dataset.dropdownPlacement = 'bottom';
    }

    panel.style.left = '0';
    panel.style.right = 'auto';
    dropdownEl.dataset.dropdownAlign = 'left';
    const adjustedRect = panel.getBoundingClientRect();
    if (adjustedRect.right > viewportWidth - 12) {
      panel.style.left = 'auto';
      panel.style.right = '0';
      dropdownEl.dataset.dropdownAlign = 'right';
    } else if (adjustedRect.left < 12) {
      panel.style.left = '0';
      panel.style.right = 'auto';
      dropdownEl.dataset.dropdownAlign = 'left';
    }
  }

  function createDropdown(type = 'default') {
    const wrapper = document.createElement('div');
    wrapper.className = 'gurum-dropdown';
    wrapper.setAttribute('data-open', 'false');
    wrapper.dataset.dropdownType = type;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'gurum-dropdown-trigger';
    trigger.dataset.dropdownType = type;

    const value = document.createElement('span');
    value.className = 'gurum-dropdown-value';
    value.textContent = '';

    const caret = document.createElement('span');
    caret.className = 'gurum-dropdown-caret';
    caret.textContent = '▾';

    trigger.append(value, caret);
    wrapper.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'gurum-dropdown-panel';
    wrapper.appendChild(panel);

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = wrapper.getAttribute('data-open') === 'true';
      closeAllDropdowns(wrapper);
      setDropdownOpen(wrapper, !isOpen);
    });

    panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    hoverToolbarState.dropdowns.push(wrapper);

    return { root: wrapper, trigger, value, panel };
  }

  function buildToneSection() {
    const dropdown = createDropdown('tone');
    const buttons = new Map();
    const options = document.createElement('div');
    options.className = 'gurum-tone-options';
    dropdown.panel.appendChild(options);

    const manageRow = document.createElement('div');
    manageRow.className = 'gurum-tone-manage-row';
    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.className = 'gurum-tone-manage';
    manageBtn.textContent = '프리셋 관리';
    manageBtn.addEventListener('click', () => {
      closeAllDropdowns();
      openTonePresetManager();
    });
    manageRow.appendChild(manageBtn);
    dropdown.panel.appendChild(manageRow);

    const renderToneButtons = () => {
      buttons.clear();
      options.innerHTML = '';
      const list = tonePresets;
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'gurum-tone-empty';
        empty.textContent = '등록된 프리셋이 없습니다.';
        options.appendChild(empty);
      } else {
        list.forEach((preset) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'gurum-tone-button';
          btn.textContent = preset.label;
          btn.dataset.tone = preset.id;
          btn.setAttribute('aria-pressed', 'false');
          btn.addEventListener('click', () => {
            hoverToolbarState.tone = preset.id;
            persistHoverToolbarState();
            clearLastSegments('tone');
            showHoverToolbarStatus(`'${preset.label}' 톤을 적용하도록 설정했습니다.`);
            closeAllDropdowns();
            syncHoverToolbarUI();
            broadcastPromptInjectionState();
          });
          buttons.set(preset.id, btn);
          options.appendChild(btn);
        });
      }
      dropdown.value.textContent = getToneLabel(hoverToolbarState.tone);
      syncHoverToolbarUI();
    };

    renderToneButtons();

    const section = document.createElement('div');
    section.className = 'gurum-section gurum-section--tone';
    const labelEl = document.createElement('span');
    labelEl.className = 'gurum-section-label';
    labelEl.textContent = '답변 톤';
    section.append(labelEl, dropdown.root);

    return { section, dropdown, buttons, refresh: renderToneButtons };
  }

  function buildTimestampSection() {
    const dropdown = createDropdown('timestamp');
    const buttons = new Map();
    const list = document.createElement('div');
    list.className = 'gurum-prompt-list';

    TIMESTAMP_PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gurum-prompt-button';
      btn.textContent = preset.label;
      btn.dataset.option = preset.id;
      btn.addEventListener('click', () => {
        hoverToolbarState.includeTimestamp = preset.value;
        persistHoverToolbarState();
        clearLastSegments('timestamp');
        showHoverToolbarStatus(
          preset.value
            ? '현재 시각을 입력란에 추가하도록 설정했습니다.'
            : '현재 시각 문구를 비활성화했습니다.',
        );
        closeAllDropdowns();
        syncHoverToolbarUI();
        broadcastPromptInjectionState();
      });
      buttons.set(preset.id, btn);
      list.appendChild(btn);
    });

    dropdown.panel.appendChild(list);
    dropdown.value.textContent = getTimestampLabel(hoverToolbarState.includeTimestamp);

    const section = document.createElement('div');
    section.className = 'gurum-section gurum-section--timestamp';
    const labelEl = document.createElement('span');
    labelEl.className = 'gurum-section-label';
    labelEl.textContent = '타임스탬프';
    section.append(labelEl, dropdown.root);

    return { section, dropdown, buttons };
  }

  function buildPromptSection() {
    const dropdown = createDropdown('prompt');
    const buttons = new Map();
    const list = document.createElement('div');
    list.className = 'gurum-prompt-list';

    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'gurum-prompt-clear';
    noneBtn.textContent = '선택 안 함';
    noneBtn.dataset.prompt = 'none';
    noneBtn.addEventListener('click', () => {
      hoverToolbarState.selectedPromptId = null;
      clearLastSegments('prompt');
      showHoverToolbarStatus('커스텀 프롬프트 지시문을 제거했습니다.');
      closeAllDropdowns();
      syncHoverToolbarUI();
      broadcastPromptInjectionState();
    });
    buttons.set('none', noneBtn);
    list.appendChild(noneBtn);

    HOVER_CUSTOM_PROMPTS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gurum-prompt-button';
      btn.textContent = preset.label;
      btn.dataset.prompt = preset.id;
      btn.addEventListener('click', () => {
        hoverToolbarState.selectedPromptId = preset.id;
        clearLastSegments('prompt');
        showHoverToolbarStatus(`'${preset.label}' 프롬프트를 사용할 준비가 되었습니다.`);
        closeAllDropdowns();
        syncHoverToolbarUI();
        broadcastPromptInjectionState();
      });
      buttons.set(preset.id, btn);
      list.appendChild(btn);
    });

    dropdown.panel.appendChild(list);
    dropdown.value.textContent = getPromptLabel(hoverToolbarState.selectedPromptId);

    const section = document.createElement('div');
    section.className = 'gurum-section gurum-section--prompt';
    const labelEl = document.createElement('span');
    labelEl.className = 'gurum-section-label';
    labelEl.textContent = '커스텀 프롬프트';
    section.append(labelEl, dropdown.root);
    section.style.display = 'none';

    return { section, dropdown, buttons };
  }

  function createHoverToolbarElement() {
    hoverToolbarState.dropdowns = [];

    const container = document.createElement('div');
    container.id = HOVER_TOOLBAR_ID;
    container.setAttribute('data-theme', hoverToolbarState.theme);

    const groups = document.createElement('div');
    groups.className = 'gurum-inline-groups';
    container.appendChild(groups);
    const timestampSection = buildTimestampSection();
    const toneSection = buildToneSection();
    const promptSection = buildPromptSection();
    promptSection.section.style.display = 'none';

    const infoWrapper = document.createElement('div');
    infoWrapper.className = 'gurum-info-wrapper';
    infoWrapper.setAttribute('data-open', 'false');

    const infoButton = document.createElement('button');
    infoButton.type = 'button';
    infoButton.className = 'gurum-info-button';
    const ariaLabel = chrome?.i18n?.getMessage?.('hover_info_aria_label') || '구름툴 신기능 안내';
    infoButton.setAttribute('aria-label', ariaLabel);
    infoButton.innerHTML = '<span aria-hidden="true">?</span>';

    const infoTooltip = document.createElement('div');
    infoTooltip.className = 'gurum-info-tooltip';
    infoTooltip.setAttribute('role', 'tooltip');
    const tooltipId = `${HOVER_TOOLBAR_ID}-info-tooltip`;
    infoTooltip.id = tooltipId;
    const infoTitleEl = document.createElement('strong');
    infoTitleEl.textContent = chrome?.i18n?.getMessage?.('hover_info_title') || '구름툴 신기능';

    const infoDescEl = document.createElement('span');
    const infoDescText =
      chrome?.i18n?.getMessage?.('hover_info_desc') ||
      '답변 톤을 지정하거나\n타임스탬프를 자동으로 넣을 수 있어요.\n[구름툴 설정]>[입력창 퀵 툴바]';
    infoDescEl.innerHTML = infoDescText.replace(/\n/g, '<br/>');

    // const infoLinkEl = document.createElement('a');
    // infoLinkEl.href = 'https://gall.dcinside.com/mgallery/board/view/?id=chatgpt&no=62312';
    // infoLinkEl.target = '_blank';
    // infoLinkEl.rel = 'noopener noreferrer';
    // infoLinkEl.textContent = chrome?.i18n?.getMessage?.('hover_info_link') || '자세히 알아보기';

    // infoTooltip.append(infoTitleEl, infoDescEl, infoLinkEl);
    infoTooltip.append(infoTitleEl, infoDescEl);

    infoButton.setAttribute('aria-describedby', tooltipId);

    const openInfo = () => infoWrapper.setAttribute('data-open', 'true');
    const closeInfo = () => infoWrapper.setAttribute('data-open', 'false');

    infoWrapper.addEventListener('mouseenter', openInfo);
    infoWrapper.addEventListener('mouseleave', closeInfo);
    infoButton.addEventListener('focus', openInfo);
    infoButton.addEventListener('blur', closeInfo);

    infoWrapper.append(infoButton, infoTooltip);

    groups.append(timestampSection.section, toneSection.section, infoWrapper);

    container.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllDropdowns();
      }
    });

    return {
      container,
      refs: {
        root: container,
        toneDropdown: toneSection.dropdown,
        toneButtons: toneSection.buttons,
        toneOptionsRefresh: toneSection.refresh,
        timestampDropdown: timestampSection.dropdown,
        timestampButtons: timestampSection.buttons,
        promptDropdown: promptSection.dropdown,
        promptButtons: promptSection.buttons,
        infoWrapper,
        infoButton,
        infoTooltip,
        infoTooltipTitle: infoTitleEl,
        infoTooltipDesc: infoDescEl,
        // infoTooltipLink: infoLinkEl,
        documentHandlers: [],
      },
    };
  }

  function syncHoverToolbarUI() {
    if (!hoverToolbarState.elements) return;

    const {
      root,
      toneDropdown,
      toneButtons,
      timestampDropdown,
      timestampButtons,
      promptDropdown,
      promptButtons,
      infoTooltipTitle,
      infoTooltipDesc,
      infoTooltipLink,
      infoButton,
    } = hoverToolbarState.elements;

    if (root) {
      root.setAttribute('data-theme', hoverToolbarState.theme);
    }

    if (toneDropdown?.value) {
      toneDropdown.value.textContent = getToneLabel(hoverToolbarState.tone);
    }

    toneButtons?.forEach((btn, toneId) => {
      const active = toneId === hoverToolbarState.tone;
      btn.dataset.active = active ? 'true' : 'false';
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (promptDropdown?.value) {
      promptDropdown.value.textContent = getPromptLabel(hoverToolbarState.selectedPromptId);
    }

    promptButtons?.forEach((btn, promptId) => {
      const active =
        (promptId === 'none' && !hoverToolbarState.selectedPromptId) ||
        promptId === hoverToolbarState.selectedPromptId;
      btn.dataset.active = active ? 'true' : 'false';
    });

    if (timestampDropdown?.value) {
      timestampDropdown.value.textContent = getTimestampLabel(hoverToolbarState.includeTimestamp);
    }
    timestampButtons?.forEach((btn, optionId) => {
      const active = hoverToolbarState.includeTimestamp
        ? optionId === 'include'
        : optionId === 'exclude';
      btn.dataset.active = active ? 'true' : 'false';
    });
    if (infoTooltipTitle) {
      infoTooltipTitle.textContent =
        chrome?.i18n?.getMessage?.('hover_info_title') || '구름툴 신기능';
    }
    if (infoTooltipDesc) {
      const infoDescText =
        chrome?.i18n?.getMessage?.('hover_info_desc') ||
        '답변 톤을 지정하거나\n타임스탬프를 자동으로 넣을 수 있어요.\n[구름툴 설정]>[입력창 퀵 툴바]';
      infoTooltipDesc.innerHTML = infoDescText.replace(/\n/g, '<br/>');
    }
    if (infoTooltipLink) {
      infoTooltipLink.textContent =
        chrome?.i18n?.getMessage?.('hover_info_link') || '자세히 알아보기';
      infoTooltipLink.href = 'https://gall.dcinside.com/mgallery/board/view/?id=chatgpt&no=62312';
    }
    if (infoButton) {
      const ariaLabelText =
        chrome?.i18n?.getMessage?.('hover_info_aria_label') || '구름툴 신기능 안내';
      infoButton.setAttribute('aria-label', ariaLabelText);
    }
  }

  function persistHoverToolbarState() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.set({
      [HOVER_STORAGE_KEYS.tone]: hoverToolbarState.tone,
      [HOVER_STORAGE_KEYS.timestamp]: hoverToolbarState.includeTimestamp,
    });
  }

  function showHoverToolbarStatus(message) {
    if (hoverToolbarState.statusTimer) {
      clearTimeout(hoverToolbarState.statusTimer);
      hoverToolbarState.statusTimer = null;
    }
    if (!message) return;
    console.info('[GurumTool]', message);
  }

  function findComposerWrapper() {
    const editor = getPromptEditor();
    if (!editor) return null;

    const preferred = [
      editor.closest('[data-testid="composer"], [data-testid="chat-composer"]'),
      editor.closest('div.shadow-short'),
      editor.closest('div.shadow-xs'),
      editor.closest('div.shadow-sm'),
      editor.closest('div.grid'),
    ];
    for (const candidate of preferred) {
      if (candidate) return candidate;
    }

    let node = editor.parentElement;
    let fallback = editor.parentElement;
    while (node && node !== document.body) {
      if (node.querySelector && node.querySelector('div.ProseMirror')) {
        fallback = node;
      }
      node = node.parentElement;
    }
    return fallback;
  }

  function getPromptEditor() {
    return document.querySelector('#prompt-textarea.ProseMirror, div.ProseMirror');
  }

  function buildToneDirectiveText() {
    const preset = getTonePresetById(hoverToolbarState.tone);
    if (!preset) return '';
    const raw = typeof preset.prompt === 'string' ? preset.prompt.trim() : '';
    if (!raw) return '';
    return raw.toLowerCase().startsWith('tone:') ? raw : `tone: ${raw}`;
  }

  function closeTonePresetManager() {
    const overlay = hoverToolbarState.toneModal;
    if (!overlay) return;
    if (hoverToolbarState.toneModalEscHandler) {
      document.removeEventListener('keydown', hoverToolbarState.toneModalEscHandler, true);
      hoverToolbarState.toneModalEscHandler = null;
    }
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
    hoverToolbarState.toneModal = null;
    const trigger = hoverToolbarState.elements?.toneDropdown?.trigger;
    if (trigger && trigger instanceof HTMLElement) {
      trigger.focus({ preventScroll: true });
    }
  }

  function openTonePresetManager() {
    if (hoverToolbarState.toneModal) return;

    const overlay = document.createElement('div');
    overlay.className = 'gurum-tone-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'gurum-tone-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '톤 프리셋 관리');
    modal.tabIndex = -1;
    if (hoverToolbarState.theme === 'dark' || hoverToolbarState.theme === 'cat') {
      modal.setAttribute('data-theme', 'dark');
    }
    overlay.appendChild(modal);

    const escHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTonePresetManager();
      }
    };
    hoverToolbarState.toneModalEscHandler = escHandler;
    document.addEventListener('keydown', escHandler, true);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeTonePresetManager();
      }
    });

    const header = document.createElement('div');
    header.className = 'gurum-tone-modal-header';
    header.textContent = '톤 프리셋 관리';
    modal.appendChild(header);

    const body = document.createElement('div');
    body.className = 'gurum-tone-modal-body';
    modal.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'gurum-tone-modal-footer';
    modal.appendChild(footer);

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'gurum-tone-add';
    addButton.textContent = '프리셋 추가';
    addButton.style.marginRight = 'auto';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'gurum-tone-secondary';
    cancelButton.textContent = '취소';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'gurum-tone-primary';
    saveButton.textContent = '저장';

    footer.append(addButton, cancelButton, saveButton);

    const renderRow = (preset) => {
      const row = document.createElement('div');
      row.className = 'gurum-tone-row';
      row.dataset.id = preset.id || generateTonePresetId();

      const fields = document.createElement('div');
      fields.className = 'gurum-tone-row-fields';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'gurum-tone-input';
      labelInput.placeholder = '프리셋 이름';
      labelInput.value = preset.label || '';

      const promptInput = document.createElement('textarea');
      promptInput.className = 'gurum-tone-textarea';
      promptInput.placeholder = '프리셋에 사용할 지시문을 입력하세요.';
      promptInput.value = preset.prompt || '';

      fields.append(labelInput, promptInput);

      const actions = document.createElement('div');
      actions.className = 'gurum-tone-row-actions';

      const reorderGroup = document.createElement('div');
      reorderGroup.className = 'gurum-tone-reorder';

      const moveUpButton = document.createElement('button');
      moveUpButton.type = 'button';
      moveUpButton.className = 'gurum-tone-move';
      moveUpButton.dataset.action = 'move-up';
      moveUpButton.textContent = '▲';
      moveUpButton.setAttribute('aria-label', `${labelInput.value || '프리셋'} 위로 이동`);
      moveUpButton.addEventListener('click', () => {
        movePresetRow(row, 'up');
      });

      const moveDownButton = document.createElement('button');
      moveDownButton.type = 'button';
      moveDownButton.className = 'gurum-tone-move';
      moveDownButton.dataset.action = 'move-down';
      moveDownButton.textContent = '▼';
      moveDownButton.setAttribute('aria-label', `${labelInput.value || '프리셋'} 아래로 이동`);
      moveDownButton.addEventListener('click', () => {
        movePresetRow(row, 'down');
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'gurum-tone-delete';
      deleteButton.textContent = '삭제';
      deleteButton.addEventListener('click', () => {
        row.remove();
        updateRowControlsState();
      });

      const syncMoveLabels = () => {
        const baseName = labelInput.value.trim() || '프리셋';
        moveUpButton.setAttribute('aria-label', `${baseName} 위로 이동`);
        moveDownButton.setAttribute('aria-label', `${baseName} 아래로 이동`);
      };

      labelInput.addEventListener('input', syncMoveLabels);

      reorderGroup.append(moveUpButton, moveDownButton);

      actions.append(reorderGroup, deleteButton);

      row.append(fields, actions);
      body.appendChild(row);
      syncMoveLabels();
      return row;
    };

    const movePresetRow = (row, direction) => {
      if (!row || !row.parentElement) return;
      if (direction === 'up' && row.previousElementSibling) {
        row.parentElement.insertBefore(row, row.previousElementSibling);
      } else if (direction === 'down' && row.nextElementSibling) {
        row.parentElement.insertBefore(row.nextElementSibling, row);
      }
      updateRowControlsState();
      const input = row.querySelector('.gurum-tone-input');
      if (input) {
        input.focus({ preventScroll: true });
      }
    };

    const updateRowControlsState = () => {
      const rows = Array.from(body.querySelectorAll('.gurum-tone-row'));
      const disableDelete = rows.length <= 1;
      rows.forEach((row, index) => {
        const deleteBtn = row.querySelector('.gurum-tone-delete');
        if (deleteBtn) deleteBtn.disabled = disableDelete;
        const upBtn = row.querySelector('.gurum-tone-move[data-action="move-up"]');
        const downBtn = row.querySelector('.gurum-tone-move[data-action="move-down"]');
        if (upBtn) upBtn.disabled = index === 0;
        if (downBtn) downBtn.disabled = index === rows.length - 1;
      });
    };

    const currentPresets = getTonePresets();
    currentPresets.forEach((preset) => renderRow(preset));
    if (!currentPresets.length) {
      renderRow({ id: generateTonePresetId(), label: '새 프리셋', prompt: '' });
    }
    updateRowControlsState();

    addButton.addEventListener('click', () => {
      const row = renderRow({
        id: generateTonePresetId(),
        label: '새 프리셋',
        prompt: '',
      });
      updateRowControlsState();
      const input = row.querySelector('.gurum-tone-input');
      if (input) {
        input.focus();
        input.select();
      }
    });

    cancelButton.addEventListener('click', () => {
      closeTonePresetManager();
    });

    saveButton.addEventListener('click', () => {
      const rows = Array.from(body.querySelectorAll('.gurum-tone-row'));
      const updated = [];
      let hasError = false;

      rows.forEach((row) => {
        const id = row.dataset.id || generateTonePresetId();
        const labelInput = row.querySelector('.gurum-tone-input');
        const promptInput = row.querySelector('.gurum-tone-textarea');
        if (!labelInput || !promptInput) return;

        labelInput.classList.remove('is-error');
        promptInput.classList.remove('is-error');

        const label = labelInput.value.trim();
        if (!label) {
          labelInput.classList.add('is-error');
          if (!hasError) {
            labelInput.focus();
          }
          hasError = true;
          return;
        }

        const cleanedPrompt = promptInput.value.replace(/^\s*tone\s*:\s*/i, '').trim();

        updated.push({
          id,
          label,
          prompt: cleanedPrompt,
        });
      });

      if (hasError) return;
      if (!updated.length) {
        showHoverToolbarStatus('최소 1개의 프리셋이 필요합니다.');
        return;
      }

      setTonePresets(updated, { persist: true });
      closeTonePresetManager();
      showHoverToolbarStatus('톤 프리셋 구성을 저장했습니다.');
    });

    document.body.appendChild(overlay);
    hoverToolbarState.toneModal = overlay;

    setTimeout(() => {
      modal.focus({ preventScroll: true });
      const firstInput = body.querySelector('.gurum-tone-input');
      if (firstInput) {
        firstInput.focus({ preventScroll: true });
        firstInput.select();
      }
    }, 0);
  }

  function setHoverToolbarEnabled(next) {
    const enabled = !!next;
    if (hoverToolbarState.enabled === enabled) return;
    hoverToolbarState.enabled = enabled;
    hoverToolbarState.lastBroadcastPayload = null;
    if (!enabled) {
      closeTonePresetManager();
      cleanupHoverToolbarElements();
      hoverToolbarState.composerEl = null;
    } else {
      scheduleHoverToolbarCheck();
    }
    broadcastPromptInjectionState(true);
  }

  window.GurumHoverToolbar = Object.assign(window.GurumHoverToolbar || {}, {
    initializeHoverToolbar,
    applyHoverToolbarTheme,
    HOVER_THEME_STORAGE_KEY,
    setHoverToolbarEnabled,
  });
})();
