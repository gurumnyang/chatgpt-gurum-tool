// popup.js
// ChatGPT 보조 도구 확장 - 팝업 UI 로직
// i18n helpers
function t(id, subs) {
  try {
    if (window.LOCALE_DICT && window.LOCALE_DICT[id] && window.LOCALE_DICT[id].message) {
      let s = window.LOCALE_DICT[id].message;
      const arr = Array.isArray(subs) ? subs : [];
      arr.forEach((v, i) => {
        s = s.replace(new RegExp('\\$' + (i + 1), 'g'), v);
      });
      return s;
    }
    const msg = chrome.i18n.getMessage(id, subs || []);
    return msg || id;
  } catch {
    return id;
  }
}

function translatePage() {
  try {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const msg = t(key);
      if (msg) el.textContent = msg;
    });
  } catch {}
}

// 탭 전환
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((tc) => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
  });
});

// translate static texts
translatePage();

// Show version in meta bar
try {
  const verEl = document.getElementById('appVersion');
  if (verEl && chrome?.runtime?.getManifest) {
    const v = chrome.runtime.getManifest().version || '';
    verEl.textContent = `v${v}`;
  }
} catch {}

async function initLocaleOverride() {
  try {
    const { userLocale } = await new Promise((r) => chrome.storage.local.get('userLocale', r));
    window.LOCALE_DICT = null;
    if (userLocale && userLocale !== 'system') {
      const url = chrome.runtime.getURL(`_locales/${userLocale}/messages.json`);
      const res = await fetch(url);
      if (res.ok) {
        window.LOCALE_DICT = await res.json();
      }
    }
    translatePage();
    // re-render usage to apply translated labels
    renderUsage();
  } catch {}
}

initLocaleOverride();

// Theme apply helper
function applyTheme(theme) {
  const valid = ['light', 'dark', 'rabbit', 'cat'];
  const th = valid.includes(theme) ? theme : 'light';
  document.body.setAttribute('data-theme', th);
}

// 모델별 사용량, 한도, Deep Research, 컨텍스트 크기 등 표시
async function renderUsage() {
  // Deep Research 먼저 업데이트
  updateDeepResearchFromContent();

  // storage에서 데이터 불러오기
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(['usageCounts', 'limits', 'deepResearch', 'currentPlan'], resolve);
  });
  const usageCounts = data.usageCounts || {};
  const limits = data.limits || {};
  const deepResearch = data.deepResearch || { remaining: '-', resetAt: null, total: '-' };
  const plan = data.currentPlan || 'free';

  // 컨텍스트 모드 토글 요소/힌트
  const toggleEl = document.getElementById('contextModeToggle');
  const modeLabelEl = document.getElementById('contextModeLabel');
  const isInferenceMode = !!(toggleEl && toggleEl.checked);
  // apply theme early
  const { popupTheme } = await new Promise((r) => chrome.storage.local.get('popupTheme', r));
  applyTheme(popupTheme || 'light');

  // 타입에 따른 카운트 계산 함수 추가
  function getCountByType(timestamps, type) {
    if (!timestamps || !Array.isArray(timestamps)) return 0;

    const now = Date.now();
    let cutoffTime;

    switch (type) {
      case 'fiveHour':
        cutoffTime = now - 5 * 60 * 60 * 1000; // 5시간 전
        break;
      case 'threeHour':
        cutoffTime = now - 3 * 60 * 60 * 1000; // 3시간 전
        break;
      case 'daily':
        cutoffTime = now - 24 * 60 * 60 * 1000; // 24시간(1일) 전
        break;
      case 'weekly':
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 7일 전
        break;
      case 'monthly':
        cutoffTime = now - 30 * 24 * 60 * 60 * 1000; // 30일 전
        break;
      default:
        cutoffTime = 0;
    }

    // 해당 기간 이후의 타임스탬프만 필터링해서 개수 반환
    return timestamps.filter((timestamp) => timestamp >= cutoffTime).length;
  }

  // 모델별 사용량 리스트
  const modelUsageList = document.getElementById('modelUsageList');
  modelUsageList.innerHTML = '';
  // gpt-5 계열 우선 정렬 (그 외는 알파벳 정렬)
  const gpt5Rank = { 'gpt-5': 0, 'gpt-5-thinking': 1, 'gpt-5-pro': 2 };
  const sortedModels = Object.keys(limits)
    .filter((m) => m !== 'deep-research')
    .sort((a, b) => {
      const a5 = a.startsWith('gpt-5');
      const b5 = b.startsWith('gpt-5');
      const a4o = a === 'gpt-4o';
      const b4o = b === 'gpt-4o';

      // gpt-5 계열 최상단
      if (a5 && !b5) return -1;
      if (!a5 && b5) return 1;
      if (a5 && b5) {
        const ra = a in gpt5Rank ? gpt5Rank[a] : 999;
        const rb = b in gpt5Rank ? gpt5Rank[b] : 999;
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b);
      }
      // 그 다음 gpt-4o 고정
      if (a4o && !b4o) return -1;
      if (!a4o && b4o) return 1;
      return a.localeCompare(b);
    });

  sortedModels.forEach((model) => {
    const usage = usageCounts[model] || { timestamps: [] };
    const limit = limits[model];
    const displayName = limit && limit.displayName ? limit.displayName : model;
    let used = 0,
      total = 0,
      type = '';

    if (limit) {
      type = limit.type;
      total = limit.value;

      // 타임스탬프 배열 기반으로 사용량 계산
      const timestampsArr =
        usage.timestamps && Array.isArray(usage.timestamps)
          ? usage.timestamps
          : usage.threeHourTimestamps && Array.isArray(usage.threeHourTimestamps)
            ? usage.threeHourTimestamps
            : null;
      if (timestampsArr) {
        used = getCountByType(timestampsArr, type);
      } else {
        // 레거시 지원 (이전 형식 데이터)
        if (type === 'daily') used = usage.daily || 0;
        else if (type === 'monthly') used = usage.monthly || 0;
        else if (type === 'threeHour' || type === 'fiveHour') used = usage.threeHour || 0;
        else used = usage.daily || 0;
      }
    }
    // 퍼센트 계산
    let percent = total ? Math.min(used / total, 1) : 0;
    let barClass = '';
    if (percent >= 0.95) barClass = 'danger';
    else if (percent >= 0.8) barClass = 'warning';
    // 모델별 UI
    const div = document.createElement('div');

    const labelType =
      {
        daily: t('limit_label_daily'),
        monthly: t('limit_label_monthly'),
        weekly: t('limit_label_weekly'),
        threeHour: t('limit_label_threeHour'),
        fiveHour: t('limit_label_fiveHour'),
        unlimited: '∞',
      }[type] || t('limit_label_daily');

    div.className = 'model-item';
    div.innerHTML = `
      <span class="model-name">${displayName}</span>
      <span class="model-usage">
        <span class="usage-count ${barClass}">${used}</span>
        <span class="usage-limit"> / ${total ? total : '∞'} (${labelType})</span>
        <div class="progress-bar"><div class="progress-fill ${barClass}" style="width:${percent * 100}%"></div></div>
      </span>
    `;
    modelUsageList.appendChild(div);
  });

  // Deep Research 남은 횟수
  const drCount = document.getElementById('deepResearchCount');
  let drClass = '';
  if (deepResearch.remaining !== '-' && deepResearch.total && deepResearch.total !== '-') {
    const drPercent = deepResearch.total ? deepResearch.remaining / deepResearch.total : 1;
    if (drPercent <= 0.05) drClass = 'danger';
    else if (drPercent <= 0.2) drClass = 'warning';
  }
  drCount.innerHTML = `
    <span class="remaining-count ${drClass}">${deepResearch.remaining}</span>
    <span class="total-limit"> / ${deepResearch.total ? deepResearch.total : '?'}${t('times_suffix')}</span>
    <span class="reset-time">${deepResearch.resetAt ? t('reset_until_prefix') + ' ' + formatCountdown(deepResearch.resetAt) : ''}</span>
    <div class="data-source">${t('refresh_to_update')}</div>
  `;
  // 컨텍스트 크기(토큰/문자)
  const contextDiv = document.getElementById('contextSize');
  getContextSize().then((size) => {
    if (!size) {
      contextDiv.textContent = '-';
      return;
    }

    // 컨텍스트 한도: 모드에 따라 계산
    let contextLimit;
    if (isInferenceMode) {
      // 추론 모델(o3, o4-mini, gpt-5-thinking): 현재는 플랜 무관 196K
      const inf = { free: 196000, plus: 196000, team: 196000, pro: 196000 };
      contextLimit = inf[plan] || 196000;
      if (modeLabelEl) modeLabelEl.textContent = t('current_mode_inference');
    } else {
      // 베이스 모델: 사이트 제공값 우선, 없으면 플랜 기본값
      contextLimit =
        size.contextLimit ||
        {
          free: 8192, // 8K
          plus: 32768, // 32K
          team: 32768, // 32K
          pro: 131072, // 128K
        }[plan] ||
        8192;
      if (modeLabelEl) modeLabelEl.textContent = t('current_mode_base');
    }

    // 토큰 수와 문자 수 표시
    const tokens = size.tokens || Math.ceil(size.chars * 0.25);
    const chars = size.chars;

    // 사용률 계산 (토큰 기준)
    const usageRatio = tokens / contextLimit;
    let statusClass = '';
    if (usageRatio >= 0.9) statusClass = 'danger';
    else if (usageRatio >= 0.7) statusClass = 'warning';

    // 좌: 글자수, 우: 토큰 형식으로 표시
    contextDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 15px; font-weight: 600;">${chars.toLocaleString()}</span>
          <span style="font-size: 12px; color: var(--muted);">${t('chars_label')}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 15px; font-weight: 600;" class="${statusClass}">${tokens.toLocaleString()}</span>
          <span style="font-size: 12px; color: var(--muted);">${t('tokens_label')}</span>
        </div>
      </div>
      <div class="progress-bar" style="width: 100%; margin-top: 8px;">
        <div class="progress-fill ${statusClass}" style="width: ${Math.min(100, usageRatio * 100)}%"></div>
      </div>
      <div style="font-size: 10px; color: var(--muted); text-align: right; margin-top: 4px;">
        ${t('max_tokens_prefix')} ${contextLimit.toLocaleString()} ${t('tokens_label')}
      </div>
    `;
  });
}

// 컨텍스트 크기 요청
function getContextSize() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return resolve(null);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'getContextSize' }, (res) => {
        resolve(res && res.size ? res.size : null);
      });
    });
  });
}

// Deep Research 리셋까지 남은 시간 포맷
function formatCountdown(resetAt) {
  const now = Date.now();
  let diff = Math.max(0, resetAt - now);
  const h = Math.floor(diff / 3600000);
  diff %= 3600000;
  const m = Math.floor(diff / 60000);
  return `${h}시간 ${m}분`;
}

// 내보내기 기능
function exportConversation(format) {
  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: 'exportConversation',
        },
        (res) => {
          if (chrome.runtime.lastError) {
            alert(t('cannot_export'));
            return;
          }
          if (!res || !res.conv) {
            alert(t('export_failed'));
            return;
          }

          // 현재 날짜와 시간으로 타임스탬프 생성
          const now = new Date();
          const timestamp = now
            .toISOString()
            .replace(/[:.]/g, '-') // 파일명에 사용할 수 없는 문자 변환
            .replace('T', '_')
            .slice(0, 19); // 밀리초 부분 제거

          const conv = res.conv;
          let blob, filename;
          switch (format) {
            case 'md': {
              const turndownService = new TurndownService();
              let md = '# ChatGPT 대화 내보내기\n\n';
              conv.forEach((msg) => {
                const html = msg.html || msg.content;
                const body = msg.html ? turndownService.turndown(html) : msg.content;
                md += `**${msg.sender}**:\n\n${body}\n\n---\n`;
              });
              blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
              filename = `chat_export_${timestamp}.md`;
              break;
            }
            case 'json': {
              blob = new Blob([JSON.stringify(conv, null, 2)], {
                type: 'application/json',
              });
              filename = `chat_export_${timestamp}.json`;
              break;
            }
            case 'txt': {
              let txt = '';
              conv.forEach((msg) => {
                txt += `[${msg.sender}]\n${msg.content}\n\n`;
              });
              blob = new Blob([txt], {
                type: 'text/plain;charset=utf-8',
              });
              filename = `chat_export_${timestamp}.txt`;
              break;
            }
          }
          const url = URL.createObjectURL(blob);
          chrome.downloads.download({
            url,
            filename,
          });
        },
      );
    },
  );
}

document.getElementById('exportMarkdown').onclick = () => exportConversation('md');
document.getElementById('exportJSON').onclick = () => exportConversation('json');
document.getElementById('exportTXT').onclick = () => exportConversation('txt');
document.getElementById('copyClipboard').onclick = () => {
  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: 'exportConversation',
        },
        (res) => {
          if (chrome.runtime.lastError) {
            alert(t('cannot_copy'));
            return;
          }
          if (!res || !res.conv) {
            alert(t('export_failed'));
            return;
          }

          // 대화 내용을 텍스트 형식으로 변환
          const conv = res.conv;
          let text = '# ChatGPT 대화 내용\n\n';
          conv.forEach((msg) => {
            const sender = msg.sender === 'user' ? '사용자' : 'ChatGPT';
            text += `[${sender}]\n${msg.content}\n\n`;
          });

          // 클립보드에 복사
          navigator.clipboard
            .writeText(text)
            .then(() => {
              // 복사 성공 시 표시
              const button = document.getElementById('copyClipboard');
              const originalText = button.textContent;
              button.textContent = t('copied');
              button.style.backgroundColor = '#28a745';

              // 2초 후 원래 텍스트로 복원
              setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '';
              }, 2000);
            })
            .catch((err) => {
              console.error('Clipboard copy failed:', err);
              alert(t('copy_failed'));
            });
        },
      );
    },
  );
};

// 설정 탭 플랜 변경 핸들러
const planSelect = document.getElementById('planSelect');
chrome.storage.local.get('currentPlan', (data) => {
  if (planSelect && data.currentPlan) planSelect.value = data.currentPlan;
});
planSelect.addEventListener('change', () => {
  const plan = planSelect.value;
  // 플랜 변경 요청 후 딥리서치 정보 및 UI 업데이트
  chrome.runtime.sendMessage({ type: 'changePlan', plan }, () => {
    // 딥리서치 resetAt 갱신을 위해 먼저 content에서 정보 가져옴
    updateDeepResearchFromContent();
  });
});

// 모델 한도 원격 동기화
const refreshRemoteBtn = document.getElementById('refreshRemoteLimits');
const remoteStatusEl = document.getElementById('remoteStatus');
const lastPlanSyncEl = document.getElementById('lastPlanSync');

function updateLastPlanSyncLabel() {
  chrome.storage.local.get('lastPlanSyncAt', (data) => {
    const ts = data.lastPlanSyncAt;
    if (!lastPlanSyncEl) return;
    if (!ts) {
      lastPlanSyncEl.textContent = `${t('last_sync_prefix')} -`;
      return;
    }
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    lastPlanSyncEl.textContent = `${t('last_sync_prefix')} ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  });
}
updateLastPlanSyncLabel();

if (refreshRemoteBtn) {
  refreshRemoteBtn.addEventListener('click', () => {
    if (remoteStatusEl) remoteStatusEl.textContent = t('syncing');
    chrome.runtime.sendMessage({ type: 'refreshPlanLimits' }, (res) => {
      if (remoteStatusEl) {
        if (res && res.updated) {
          const ver = res.version ? ` (v:${res.version})` : '';
          remoteStatusEl.textContent = `${t('sync_done')}${ver}`;
        } else {
          remoteStatusEl.textContent = t('sync_failed');
        }
      }
      // 사용량/한도 UI 재렌더
      renderUsage();
      updateLastPlanSyncLabel();
      setTimeout(() => {
        if (remoteStatusEl) remoteStatusEl.textContent = '';
      }, 3000);
    });
  });
}

// renderUsage 시작 전 Deep Research 최신화 요청
async function updateDeepResearchFromContent() {
  const tabsArr = await new Promise((r) =>
    chrome.tabs.query({ active: true, currentWindow: true }, r),
  );
  const tab = tabsArr[0];
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'checkDeepResearchRemaining' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const remaining = res.remaining;
    renderUsage();
  });
}

// 최초 렌더링
renderUsage();
// 1분마다 갱신
setInterval(renderUsage, 1000);

// 컨텍스트 모드 토글 저장/복원
const contextModeToggle = document.getElementById('contextModeToggle');
const contextModeLabel = document.getElementById('contextModeLabel');
if (contextModeToggle) {
  // 초기 복원
  chrome.storage.local.get('contextMode', (data) => {
    const saved = data.contextMode || 'base';
    contextModeToggle.checked = saved === 'inference';
    if (contextModeLabel) {
      contextModeLabel.textContent =
        saved === 'inference' ? '현재 모드: 추론 (196K)' : '현재 모드: 베이스';
    }
    // 초기 렌더 갱신
    renderUsage();
  });
  // 변경 시 저장 및 갱신
  contextModeToggle.addEventListener('change', () => {
    const mode = contextModeToggle.checked ? 'inference' : 'base';
    chrome.storage.local.set({ contextMode: mode }, () => {
      if (contextModeLabel) {
        contextModeLabel.textContent =
          mode === 'inference' ? '현재 모드: 추론 (196K)' : '현재 모드: 베이스';
      }
      renderUsage();
    });
  });
}

// Locale selector
const localeSelect = document.getElementById('localeSelect');
if (localeSelect) {
  chrome.storage.local.get('userLocale', (data) => {
    const v = data.userLocale || 'system';
    localeSelect.value = v;
  });
  localeSelect.addEventListener('change', async () => {
    const v = localeSelect.value;
    await new Promise((r) => chrome.storage.local.set({ userLocale: v }, r));
    await initLocaleOverride();
  });
}

// Theme selector
const themeSelect = document.getElementById('themeSelect');
if (themeSelect) {
  chrome.storage.local.get('popupTheme', (data) => {
    const v = data.popupTheme || 'light';
    themeSelect.value = v;
    applyTheme(v);
  });
  themeSelect.addEventListener('change', () => {
    const v = themeSelect.value;
    chrome.storage.local.set({ popupTheme: v }, () => applyTheme(v));
  });
}

// Timestamps toggle
const toggleTimestamps = document.getElementById('toggleTimestamps');
if (toggleTimestamps) {
  chrome.storage.local.get('showTimestamps', (data) => {
    toggleTimestamps.checked = !!data.showTimestamps;
  });
  toggleTimestamps.addEventListener('change', async () => {
    const enabled = !!toggleTimestamps.checked;
    await new Promise((r) => chrome.storage.local.set({ showTimestamps: enabled }, r));
    // Notify active tab content script to apply immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { type: 'applyTimestampSetting', enabled });
    });
  });
}
