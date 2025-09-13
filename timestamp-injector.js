// timestamp-injector.js
// Injects human-readable timestamps into ChatGPT messages on chat.openai.com/chatgpt.com
// Works together with fetch-hook.js which posts GURUM_TS_CONV_DATA with {id, role, create_time}

(() => {
  const STATE = {
    enabled: false,
    tsMap: new Map(), // messageId -> ms timestamp
    observer: null,
    styleEl: null,
    inited: false,
    _startScheduled: false,
  };

  function toMs(t) {
    const n = Number(t);
    if (!isFinite(n)) return Date.now();
    return n < 1e10 ? Math.round(n * 1000) : Math.round(n);
  }

  function format(ts) {
    const d = new Date(ts);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function ensureStyle() {
    if (STATE.styleEl) return;
    const css = `
      .chatgpt-time-container { 
        display:block; 
        width:100%; 
        box-sizing:border-box;
        padding: 0; 
        margin: 0; 
        color:#9aa4b2; 
        font-size: 12px; 
        line-height: 1.2;
      }
      .chatgpt-time-container.user { text-align: right; color:#6c757d; }
      .chatgpt-time-container.assistant { text-align: left; color:#9aa4b2; }
    `;
    const el = document.createElement('style');
    el.id = 'gurum-ts-style';
    el.textContent = css;
    document.documentElement.appendChild(el);
    STATE.styleEl = el;
  }

  function removeStyle() {
    if (STATE.styleEl && STATE.styleEl.parentNode)
      STATE.styleEl.parentNode.removeChild(STATE.styleEl);
    STATE.styleEl = null;
  }

  function setEnabled(v) {
    STATE.enabled = !!v;
    if (STATE.enabled) {
      ensureStyle();
      startObserver();
      // initial sweep
      renderAll();
    } else {
      stopObserver();
      cleanupAll();
      removeStyle();
    }
  }

  function cleanupAll() {
    document.querySelectorAll('.chatgpt-time-container').forEach((n) => n.remove());
  }

  function startObserver() {
    if (STATE.observer) return;
    const target = document.body;
    if (!target) {
      scheduleObserverStart();
      return;
    }
    const obs = new MutationObserver((mutations) => {
      if (!STATE.enabled) return;
      let work = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.hasAttribute && node.hasAttribute('data-message-id')) work = true;
            if (!work) {
              const inner = node.querySelector && node.querySelector('div[data-message-id]');
              if (inner) work = true;
            }
          }
        } else if (m.type === 'attributes') {
          if (m.target && m.target.hasAttribute && m.target.hasAttribute('data-message-id'))
            work = true;
        }
        if (work) break;
      }
      if (work) renderAll();
    });
    obs.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-message-id'],
    });
    STATE.observer = obs;
  }

  function stopObserver() {
    if (STATE.observer) {
      STATE.observer.disconnect();
      STATE.observer = null;
    }
  }

  function scheduleObserverStart() {
    if (STATE._startScheduled) return;
    STATE._startScheduled = true;
    const tryStart = () => {
      if (!STATE.enabled || STATE.observer) return;
      const t = document.body;
      if (t) {
        STATE._startScheduled = false;
        startObserver();
        // DOM 준비 후 한 번 더 스윕
        renderAll();
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryStart, { once: true });
    } else {
      setTimeout(tryStart, 0);
    }
  }

  function setTimestamp(id, value) {
    STATE.tsMap.set(id, toMs(value));
  }

  function getTimestampForMessage(div) {
    const id = div.getAttribute('data-message-id');
    if (!id) return null;
    if (STATE.tsMap.has(id)) return STATE.tsMap.get(id);
    // fallback: create on first sight
    const existing = div.getAttribute('data-gurum-ts');
    if (existing) return Number(existing);
    const now = Date.now();
    div.setAttribute('data-gurum-ts', String(now));
    return now;
  }

  function renderAll() {
    // prefer most recent first for quick perceived update
    const nodes = Array.from(document.querySelectorAll('div[data-message-id]'));
    nodes.sort((a, b) => (getTimestampForMessage(b) || 0) - (getTimestampForMessage(a) || 0));
    for (const msgDiv of nodes) {
      renderOne(msgDiv);
    }
  }

  function renderOne(messageDiv) {
    if (!STATE.enabled || !messageDiv) return;
    try {
      const id = messageDiv.getAttribute('data-message-id');
      if (!id) return;
      const role = messageDiv.getAttribute('data-message-author-role') || '';
      // 변경: 부모가 아닌 메시지 엘리먼트 내부에 삽입
      const root = messageDiv;
      const cls = 'chatgpt-time-container';
      const existed = root.querySelector(`.${cls}`);
      const ts = getTimestampForMessage(messageDiv);
      const html = `<span class="${cls} ${role}">${format(ts)}</span>`;
      if (existed) {
        existed.outerHTML = html; // 기존 라벨 교체
      } else {
        // 메시지 엘리먼트의 첫 자식으로 삽입
        root.insertAdjacentHTML('afterbegin', html);
      }
    } catch (_) {}
  }

  function initOnce() {
    if (STATE.inited) return;
    STATE.inited = true;
    // Listen page messages
    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'GURUM_TS_ENABLE') {
        setEnabled(true);
      } else if (d.type === 'GURUM_TS_DISABLE') {
        setEnabled(false);
      } else if (d.type === 'GURUM_TS_CONV_DATA' && Array.isArray(d.messages)) {
        for (const m of d.messages) {
          if (!m || !m.id) continue;
          setTimestamp(m.id, m.create_time);
        }
        if (STATE.enabled) renderAll();
      }
    });
  }

  initOnce();
})();
