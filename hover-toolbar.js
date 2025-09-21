(() => {
  const HOVER_TOOLBAR_ID = 'gurum-hover-toolbar';
  const HOVER_TOOLBAR_STYLE_ID = 'gurum-hover-toolbar-style';
  const HOVER_THEME_STORAGE_KEY = 'popupTheme';
  const HOVER_STORAGE_KEYS = {
    tone: 'hoverToolbarTone',
    timestamp: 'hoverToolbarIncludeTimestamp',
  };

  const HOVER_TONE_PRESETS = [
    { id: 'neutral', label: '기본', prompt: '' },
    {
      id: 'friendly',
      label: '친근',
      prompt: 'tone: 답변을 따뜻하고 우호적인 느낌을 주는 톤',
    },
    {
      id: 'polite',
      label: '격식',
      prompt: 'tone: 답변을 정중하고 격식 있는 문체',
    },
    {
      id: 'monday',
      label: '비관적',
      prompt: 'tone: 답변을 다소 비관적이고 회의적인 톤',
    },
    {
      id: 'dcinside',
      label: '디시',
      prompt: 'tone: 디시인사이드의 천박한 말투. 거칠고 직설적임.',
    },
  ];

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
    #${HOVER_TOOLBAR_ID} {
      width: 100%;
      display: flex;
      justify-content: stretch;
      margin-bottom: 8px;
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

    #${HOVER_TOOLBAR_ID} .gurum-dropdown[data-dropdown-type='tone'] .gurum-dropdown-trigger,
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
      z-index: 4;
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
      gap: 6px;
      width: 100%;
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
  `;

  const hoverToolbarState = {
    tone: 'neutral',
    includeTimestamp: false,
    selectedPromptId: null,
    theme: 'light',
    composerEl: null,
    observer: null,
    checkTimer: null,
    initRequested: false,
    statusTimer: null,
    elements: null,
    dropdowns: [],
    lastSegments: {
      tone: null,
      prompt: null,
      timestamp: null,
    },
    lastBroadcastPayload: null,
  };
  const DROPDOWN_MAX_HEIGHT = 280;

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
    const keys = [HOVER_STORAGE_KEYS.tone, HOVER_STORAGE_KEYS.timestamp, HOVER_THEME_STORAGE_KEY];
    chrome.storage.local.get(keys, (res) => {
      try {
        if (res && typeof res[HOVER_STORAGE_KEYS.tone] === 'string') {
          const value = res[HOVER_STORAGE_KEYS.tone];
          if (HOVER_TONE_PRESETS.some((preset) => preset.id === value)) {
            hoverToolbarState.tone = value;
          }
        }
        if (res && typeof res[HOVER_STORAGE_KEYS.timestamp] === 'boolean') {
          hoverToolbarState.includeTimestamp = res[HOVER_STORAGE_KEYS.timestamp];
        }
        if (res && typeof res[HOVER_THEME_STORAGE_KEY] === 'string') {
          applyHoverToolbarTheme(res[HOVER_THEME_STORAGE_KEY]);
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
    const preset = HOVER_TONE_PRESETS.find((item) => item.id === toneId);
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

    HOVER_TONE_PRESETS.forEach((preset) => {
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

    dropdown.panel.appendChild(options);
    dropdown.value.textContent = getToneLabel(hoverToolbarState.tone);

    const section = document.createElement('div');
    section.className = 'gurum-section gurum-section--tone';
    const labelEl = document.createElement('span');
    labelEl.className = 'gurum-section-label';
    labelEl.textContent = '답변 톤';
    section.append(labelEl, dropdown.root);

    return { section, dropdown, buttons };
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

    groups.append(timestampSection.section, toneSection.section);

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
        timestampDropdown: timestampSection.dropdown,
        timestampButtons: timestampSection.buttons,
        promptDropdown: promptSection.dropdown,
        promptButtons: promptSection.buttons,
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
    if (hoverToolbarState.tone === 'neutral') return '';
    const preset = HOVER_TONE_PRESETS.find((item) => item.id === hoverToolbarState.tone);
    return preset ? preset.prompt : '';
  }

  window.GurumHoverToolbar = Object.assign(window.GurumHoverToolbar || {}, {
    initializeHoverToolbar,
    applyHoverToolbarTheme,
    HOVER_THEME_STORAGE_KEY,
  });
})();
