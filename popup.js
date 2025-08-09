// popup.js
// ChatGPT 보조 도구 확장 - 팝업 UI 로직

// 탭 전환
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
  });
});

// 모델별 사용량, 한도, Deep Research, 컨텍스트 크기 등 표시
async function renderUsage() {
  // Deep Research 먼저 업데이트
  updateDeepResearchFromContent();

  // storage에서 데이터 불러오기
  const data = await new Promise(resolve => {
    chrome.storage.local.get([
      'usageCounts', 'limits', 'deepResearch', 'currentPlan'
    ], resolve);
  });
  const usageCounts = data.usageCounts || {};
  const limits = data.limits || {};
  const deepResearch = data.deepResearch || { remaining: '-', resetAt: null, total: '-' };
  const plan = data.currentPlan || 'free';

  // 타입에 따른 카운트 계산 함수 추가
  function getCountByType(timestamps, type) {
    if (!timestamps || !Array.isArray(timestamps)) return 0;
    
    const now = Date.now();
    let cutoffTime;
    
    switch (type) {
      case 'threeHour':
      cutoffTime = now - (3 * 60 * 60 * 1000); // 3시간 전
      break;
      case 'daily':
      cutoffTime = now - (24 * 60 * 60 * 1000); // 24시간(1일) 전
      break;
      case 'weekly':
      cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7일 전
      break;
      case 'monthly':
      cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30일 전
      break;
      default:
      cutoffTime = 0;
    }
    
    // 해당 기간 이후의 타임스탬프만 필터링해서 개수 반환
    return timestamps.filter(timestamp => timestamp >= cutoffTime).length;
  }

  // 모델별 사용량 리스트
  const modelUsageList = document.getElementById('modelUsageList');
  modelUsageList.innerHTML = '';
  // gpt-5 계열 우선 정렬 (그 외는 알파벳 정렬)
  const gpt5Rank = { 'gpt-5': 0, 'gpt-5-thinking': 1, 'gpt-5-pro': 2 };
  const sortedModels = Object.keys(limits)
    .filter(m => m !== 'deep-research')
    .sort((a, b) => {
      const a5 = a.startsWith('gpt-5');
      const b5 = b.startsWith('gpt-5');
      const a4o = a === 'gpt-4o';
      const b4o = b === 'gpt-4o';

      // gpt-5 계열 최상단
      if (a5 && !b5) return -1;
      if (!a5 && b5) return 1;
      if (a5 && b5) {
        const ra = (a in gpt5Rank) ? gpt5Rank[a] : 999;
        const rb = (b in gpt5Rank) ? gpt5Rank[b] : 999;
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b);
      }
      // 그 다음 gpt-4o 고정
      if (a4o && !b4o) return -1;
      if (!a4o && b4o) return 1;
      return a.localeCompare(b);
    });

  sortedModels.forEach(model => {
    
    const usage = usageCounts[model] || { timestamps: [] };
    const limit = limits[model];
    let used = 0, total = 0, type = '';
    
    if (limit) {
      type = limit.type;
      total = limit.value;
      
      // 타임스탬프 배열 기반으로 사용량 계산
      if (usage.timestamps && Array.isArray(usage.timestamps)) {
        used = getCountByType(usage.timestamps, type);
      } else {
        // 레거시 지원 (이전 형식 데이터)
        if (type === 'daily') used = usage.daily || 0;
        else if (type === 'monthly') used = usage.monthly || 0;
        else if (type === 'threeHour') used = usage.threeHour || 0;
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

    const labelType = {
        daily: '일간',
        monthly: '월간',
        threeHour: '3시간',
        unlimited: '무제한'
    }[type] || '일간';

    div.className = 'model-item';
    div.innerHTML = `
      <span class="model-name">${model}</span>
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
    <span class="total-limit"> / ${deepResearch.total ? deepResearch.total : '?'}회</span>
    <span class="reset-time">${deepResearch.resetAt ? '리셋까지: ' + formatCountdown(deepResearch.resetAt) : ''}</span>
    <div class="data-source">(새로고침하여 갱신)</div>
  `;
  // 컨텍스트 크기(토큰/문자)
  const contextDiv = document.getElementById('contextSize');
  getContextSize().then(size => {
    if (!size) {
      contextDiv.textContent = '-';
      return;
    }
    
    // 현재 플랜에 따른 컨텍스트 한도 사용
    const contextLimit = size.contextLimit || {
      'free': 8192,     // 8K
      'plus': 32768,    // 32K
      'pro': 131072     // 128K
    }[plan] || 8192;    // 기본값은 Free 플랜
    
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
          <span style="font-size: 12px; color: #6c757d;">글자</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 15px; font-weight: 600;" class="${statusClass}">${tokens.toLocaleString()}</span>
          <span style="font-size: 12px; color: #6c757d;">토큰</span>
        </div>
      </div>
      <div class="progress-bar" style="width: 100%; margin-top: 8px;">
        <div class="progress-fill ${statusClass}" style="width: ${Math.min(100, usageRatio * 100)}%"></div>
      </div>
      <div style="font-size: 10px; color: #6c757d; text-align: right; margin-top: 4px;">
        최대 ${contextLimit.toLocaleString()} 토큰
      </div>
    `;
  });
}

// 컨텍스트 크기 요청
function getContextSize() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]) return resolve(null);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'getContextSize' }, res => {
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
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, tabs => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'exportConversation'
    }, res => {
      if (chrome.runtime.lastError) {
        alert('대화를 내보낼 수 없습니다. 페이지에서 확장 콘텐츠 스크립트를 사용할 수 없습니다.');
        return;
      }
      if (!res || !res.conv) {
        alert('대화 추출 실패');
        return;
      }
      
      // 현재 날짜와 시간으로 타임스탬프 생성
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')  // 파일명에 사용할 수 없는 문자 변환
        .replace('T', '_')
        .slice(0, 19);  // 밀리초 부분 제거
      
      const conv = res.conv;
      let blob, filename;
      switch (format) {
        case 'md': {
          const turndownService = new TurndownService();
          let md = '# ChatGPT 대화 내보내기\n\n';
          conv.forEach(msg => {
            console.log(msg.html);
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
            type: 'application/json'
          });
          filename = `chat_export_${timestamp}.json`;
          break;
        }        
        case 'txt': {
          let txt = '';
          conv.forEach(msg => {
            txt += `[${msg.sender}]\n${msg.content}\n\n`;
          });
          blob = new Blob([txt], {
            type: 'text/plain;charset=utf-8'
          });
          filename = `chat_export_${timestamp}.txt`;
          break;
        }
      }
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename
      });
    });
  });
}

document.getElementById('exportMarkdown').onclick = () => exportConversation('md');
document.getElementById('exportJSON').onclick = () => exportConversation('json');
document.getElementById('exportTXT').onclick = () => exportConversation('txt');
document.getElementById('copyClipboard').onclick = () => {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, tabs => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'exportConversation'
    }, res => {
      if (chrome.runtime.lastError) {
        alert('대화를 복사할 수 없습니다. 페이지에서 확장 콘텐츠 스크립트를 사용할 수 없습니다.');
        return;
      }
      if (!res || !res.conv) {
        alert('대화 추출 실패');
        return;
      }
      
      // 대화 내용을 텍스트 형식으로 변환
      const conv = res.conv;
      let text = '# ChatGPT 대화 내용\n\n';
      conv.forEach(msg => {
        const sender = msg.sender === 'user' ? '사용자' : 'ChatGPT';
        text += `[${sender}]\n${msg.content}\n\n`;
      });
      
      // 클립보드에 복사
      navigator.clipboard.writeText(text)
        .then(() => {
          // 복사 성공 시 표시
          const button = document.getElementById('copyClipboard');
          const originalText = button.textContent;
          button.textContent = '복사됨!';
          button.style.backgroundColor = '#28a745';
          
          // 2초 후 원래 텍스트로 복원
          setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '#6c757d';
          }, 2000);
        })
        .catch(err => {
          console.error('클립보드 복사 실패:', err);
          alert('클립보드 복사에 실패했습니다.');
        });
    });
  });
};

// 설정 탭 플랜 변경 핸들러
const planSelect = document.getElementById('planSelect');
chrome.storage.local.get('currentPlan', data => {
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

// renderUsage 시작 전 Deep Research 최신화 요청
async function updateDeepResearchFromContent() {
  const tabsArr = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
  const tab = tabsArr[0];
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'checkDeepResearchRemaining' }, res => {
    if (chrome.runtime.lastError || !res) return;
    const remaining = res.remaining;
    renderUsage();
  });
}

// 최초 렌더링
renderUsage();
// 1분마다 갱신
setInterval(renderUsage, 1000);
