console.log('Background script running.');

// 원격 플랜 한도 구성 URL (고정)
const REMOTE_LIMITS_URL = 'https://raw.githubusercontent.com/gurumnyang/chatgpt-gurum-tool/main/config/plan-limits.json';

// 원격 플랜 한도 불러오기
async function fetchRemotePlanLimits() {
    const url = REMOTE_LIMITS_URL;
    try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || !data.plans) throw new Error('Invalid plan JSON');
        return data; // { version, updatedAt, plans }
    } catch (e) {
        console.warn('원격 플랜 한도 로드 실패:', e);
        return null;
    }
}

// 현재 플랜 템플릿(원격 > 로컬) 조회
async function getPlanLimitsTemplate() {
    const data = await chrome.storage.local.get(['planLimitsAll']);
    return data.planLimitsAll || defaultLimits;
}

// Deep Research total 조회
async function getDeepResearchTotalFor(plan) {
    const tmpl = await getPlanLimitsTemplate();
    return tmpl[plan] && tmpl[plan]['deep-research'] && tmpl[plan]['deep-research'].value != null
        ? tmpl[plan]['deep-research'].value
        : '-';
}

// 원격 플랜 한도 동기화
async function refreshPlanLimitsFromRemote() {
    try {
        const conf = await chrome.storage.local.get(['currentPlan']);
        const plan = conf.currentPlan || currentPlan || 'free';
        const remote = await fetchRemotePlanLimits();
        if (!remote) return { updated: false };
        const planLimitsAll = remote.plans;
        const limits = planLimitsAll[plan] || defaultLimits[plan] || {};

        const now = Date.now();
        await chrome.storage.local.set({ planLimitsAll, limits, lastPlanSyncAt: now });

        // Deep Research total 동기화 (remaining 유지)
        chrome.storage.local.get('deepResearch', data => {
            const dr = data.deepResearch || {};
            dr.total = (planLimitsAll[plan]?.['deep-research']?.value ?? dr.total ?? '-');
            chrome.storage.local.set({ deepResearch: dr });
        });

        return { updated: true, version: remote.version, updatedAt: remote.updatedAt, lastSyncAt: now };
    } catch (e) {
        console.warn('원격 플랜 동기화 실패:', e);
        return { updated: false };
    }
}

/**
 * 타입별(3시간/일간/주간/월간) 카운트 계산
 * @param {Array} timestamps - 타임스탬프 배열
 * @param {string} type - "threeHour", "daily", "weekly", "monthly" 중 하나
 * @returns {number} 해당 기간 내 카운트
 */
function getCountByType(timestamps, type) {
  if (!timestamps || !Array.isArray(timestamps)) return 0;
  
  const now = Date.now();
  let cutoffTime;
  
  switch (type) {
    case 'fiveHour':
      cutoffTime = now - (5 * 60 * 60 * 1000); // 5시간
      break;
    case 'threeHour':
      cutoffTime = now - (3 * 60 * 60 * 1000); // 3시간
      break;
    case 'daily':
      // 당일 00:00 KST 기준
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoffTime = today.getTime();
      break;
    case 'weekly':
      // 이번 주 월요일 00:00 KST 기준
      const thisMonday = new Date();
      thisMonday.setHours(0, 0, 0, 0);
      // 월요일이 0이 아니라 1이므로 일요일은 0, 월요일은 1...
      const daysSinceMonday = (thisMonday.getDay() + 6) % 7; // 월요일을 기준으로 날짜 조정
      thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);
      cutoffTime = thisMonday.getTime();
      break;
    case 'monthly':
      // 이번 달 1일 00:00 KST 기준
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      cutoffTime = thisMonth.getTime();
      break;
    default:
      cutoffTime = 0;
  }
  
  // 해당 기간 이후의 타임스탬프만 필터링해서 개수 반환
  return timestamps.filter(timestamp => timestamp >= cutoffTime).length;
}

// 공통: 다음 리셋 시각 계산 (KST 자정 기준)
function getNextResetTimestamp() {
    const now = new Date();
    const kstMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
    if (now.getTime() >= kstMidnight.getTime()) {
        kstMidnight.setUTCDate(kstMidnight.getUTCDate() + 1);
    }
    return kstMidnight.getTime();
}

// 딥리서치 전용: 월간 리셋 시각 계산 (매월 1일 KST 00:00)
function getNextMonthlyResetTimestamp() {
    const now = new Date();
    // 다음 달 1일 자정(로컬 시간 KST 기준)
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    return next.getTime();
}

// 알림 임계치 (예: 80%)
const NOTIFY_THRESHOLD = 0.8;

// 임시 데이터 저장은 필요하지 않음 (웹 요청 직접 모니터링 대신 메시지 사용)

// conversation/init API 요청은 fetch-hook.js와 content script를 통해 처리
// webRequest 권한이 제거되어 직접적인 API 요청 모니터링은 사용하지 않음


// 메시지 카운트 데이터는 updateModelUsageWithWorkspace 함수로 처리

// Deep Research API 모니터링은 content script와 fetch-hook.js를 통해 처리


// 기본 모델별 한도 (예시)
// 플랜별 모델 한도 설정
const defaultLimits = {
    free: {
    // 무료는 gpt-4o, o4-mini 사용 불가
        "gpt-5": { type: "fiveHour", value: 10 },
        "gpt-5-thinking": { type: "daily", value: 1 },
        // Deep Research
        "deep-research": { type: "monthly", value: 5 }
    },
    plus: {
        // 기존 모델들
        "gpt-4o": { type: "threeHour", value: 80 },
        "gpt-4-1": { type: "threeHour", value: 80 },
        "o3": { type: "weekly", value: 100 },
        "o4-mini": { type: "daily", value: 300 },
        // 신규 모델
    // 정책 변경: GPT-5 3시간 160, GPT-5-thinking 주 3000
    "gpt-5": { type: "threeHour", value: 160 },
    "gpt-5-thinking": { type: "weekly", value: 3000 },
        // Deep Research
        "deep-research": { type: "monthly", value: 25 }
    },
    team: {
        // Plus와 동일한 라인업 + 다음 오버라이드 적용
        // 오버라이드:
    // - gpt-5 3시간 160
        // - gpt-4o 160/3시간
        // - gpt-4-1 160/3시간
        "gpt-4o": { type: "threeHour", value: 160 },
        "gpt-4-1": { type: "threeHour", value: 160 },
        "o3": { type: "weekly", value: 100 },
        "o4-mini": { type: "daily", value: 300 },
    "gpt-5": { type: "threeHour", value: 160 },
    "gpt-5-thinking": { type: "weekly", value: 3000 },
        "deep-research": { type: "monthly", value: 25 }
    },
    pro: {
        // 기존 모델들
        "gpt-4o": { type: "unlimited", value: null },
        "gpt-4-1": { type: "unlimited", value: null },
        "gpt-4-5": { type: "unlimited", value: null },
        "o3": { type: "unlimited", value: null },
        "o4-mini": { type: "unlimited", value: null },
        "o3-pro": { type: "unlimited", value: null },
        // 신규 모델 (Pro 무제한)
        "gpt-5": { type: "unlimited", value: null },
        "gpt-5-thinking": { type: "unlimited", value: null }, // gpt-5-thinking은 Pro만 무제한
        "gpt-5-pro": { type: "unlimited", value: null },
        // Deep Research
        "deep-research": { type: "monthly", value: 250 }
    }
};

// 정책 변경(2025-08): 모델/플랜 한도 마이그레이션
async function migratePolicy2025_08() {
    try {
        const data = await chrome.storage.local.get(['usageCounts', 'limits', 'currentPlan', 'planLimitsAll']);
        const counts = data.usageCounts || {};
        let limits = data.limits || {};
        const plan = data.currentPlan || currentPlan || 'free';
        const planTmpl = data.planLimitsAll || defaultLimits;

        // 1) 완전 삭제: gpt-4-1-mini
        if (counts['gpt-4-1-mini']) delete counts['gpt-4-1-mini'];
        if (limits['gpt-4-1-mini']) delete limits['gpt-4-1-mini'];

        // 2) GPT-4-5는 Pro 전용: Plus/Team 저장된 limits에서 제거
        if ((plan === 'plus' || plan === 'team') && limits['gpt-4-5']) {
            delete limits['gpt-4-5'];
        }

        // 3) 플랜별 정책 보정
        if (plan === 'team') {
            // Team: 최신 템플릿 전체 적용
            limits = { ...planTmpl.team };
        } else if (plan === 'plus') {
            // Plus: gpt-5 3시간 160, gpt-5-thinking 주 3000
            limits['gpt-5'] = { type: 'threeHour', value: 160 };
            limits['gpt-5-thinking'] = { type: 'weekly', value: 3000 };
            // 기타 키는 기존 값 유지 (필요 시 기본값 병합 가능)
        } else if (plan === 'free') {
            // Free: gpt-4o, o4-mini 사용 불가
            if (counts['gpt-4o']) delete counts['gpt-4o'];
            if (counts['o4-mini']) delete counts['o4-mini'];
            if (limits['gpt-4o']) delete limits['gpt-4o'];
            if (limits['o4-mini']) delete limits['o4-mini'];
            limits['gpt-5'] = { type: 'fiveHour', value: 10 };
        }

        await chrome.storage.local.set({ usageCounts: counts, limits });
    } catch (e) {
        console.warn('정책 마이그레이션(2025-08) 실패:', e);
    }
}

// o4-mini-high -> o4-mini 마이그레이션 (사용량/한도) 유틸
async function migrateO4MiniHigh() {
    try {
        const data = await chrome.storage.local.get(['usageCounts', 'limits']);
        const counts = data.usageCounts || {};
        const limits = data.limits || {};

        // 사용량 합치기
        if (counts['o4-mini-high']) {
            const src = counts['o4-mini-high'];
            const dst = counts['o4-mini'] || {};

            // timestamps 기반 합치기
            if (src.timestamps || dst.timestamps) {
                const a = Array.isArray(dst.timestamps) ? dst.timestamps : [];
                const b = Array.isArray(src.timestamps) ? src.timestamps : [];
                const merged = Array.from(new Set([...(a || []), ...(b || [])])).sort();
                dst.timestamps = merged;
            }
            // 레거시 카운터 합치기
            dst.daily = (dst.daily || 0) + (src.daily || 0);
            dst.monthly = (dst.monthly || 0) + (src.monthly || 0);
            dst.threeHour = (dst.threeHour || 0) + (src.threeHour || 0);

            counts['o4-mini'] = dst;
            delete counts['o4-mini-high'];
        }

        // limits에서 제거
        if (limits['o4-mini-high']) {
            delete limits['o4-mini-high'];
        }

        await chrome.storage.local.set({ usageCounts: counts, limits });
    } catch (e) {
        console.warn('o4-mini-high 마이그레이션 실패:', e);
    }
}

// 현재 사용자 플랜 (초기값: free, 나중에 설정 UI에서 변경 가능)
let currentPlan = "free";

// storage 초기화
chrome.runtime.onInstalled.addListener(() => {
    (async () => {
        const drTotal = await getDeepResearchTotalFor(currentPlan);
        const initialDr = {
            remaining: '-',
            total: drTotal || '-',
            resetAt: getNextMonthlyResetTimestamp()
        };
        await chrome.storage.local.set({ 
            usageCounts: {}, 
            limits: defaultLimits[currentPlan],
            currentPlan: currentPlan,
            deepResearch: initialDr
        });
        // 오래된 데이터 정리 알람
        chrome.alarms.create('cleanupData', { periodInMinutes: 24 * 60 });
        // 플랜 한도 주기 동기화 알람 (6시간마다)
        chrome.alarms.create('refreshPlanLimits', { periodInMinutes: 6 * 60 });
        // 원격 플랜 동기화 시도
        await refreshPlanLimitsFromRemote();
        // 마이그레이션 수행
        migrateO4MiniHigh();
        migratePolicy2025_08();
    })();
});

// 브라우저 시작 시에도 마이그레이션 보장
chrome.runtime.onStartup.addListener(() => {
    (async () => {
        // 주기 동기화 알람 보장
        chrome.alarms.create('refreshPlanLimits', { periodInMinutes: 6 * 60 });
        await refreshPlanLimitsFromRemote();
        migrateO4MiniHigh();
        migratePolicy2025_08();
    })();
});

// 데이터 정리 알람은 직접 onInstalled에서 등록

chrome.alarms.onAlarm.addListener((alarm) => {
    // 데이터 정리 알람만 처리
    if (alarm.name === 'cleanupData') {
        cleanupOldData();
        
        // 배지 업데이트 (타임스탬프 기반으로 계산)
        chrome.storage.local.get('usageCounts', data => {
            updateBadge(data.usageCounts || {});
        });
    } else if (alarm.name === 'refreshPlanLimits') {
        // 원격 플랜 동기화 (주기)
        refreshPlanLimitsFromRemote();
    }
});

// 메시지 카운트 업데이트
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. Request/fetch Hook에서 캡처한 conversation/init 요청 처리
    if (message.type === 'init_request_captured' && message.data) {
        console.log('📨 Content script로부터 conversation/init 데이터 수신:', message.data);
        
        try {
            const { url, body } = message.data;
            
            // Deep Research 정보 추출 및 저장
            if (body && body.limits_progress) {
                const deepResearchLimit = body.limits_progress.find(
                    limit => limit.feature_name === 'deep_research'
                );
                
                if (deepResearchLimit) {
                    const remaining = deepResearchLimit.remaining;
                    const resetTime = deepResearchLimit.reset_after;

                    console.log('💡 Deep Research 정보 추출 성공:', { remaining, resetTime });

                    // storage 업데이트
                    chrome.storage.local.get(['deepResearch', 'currentPlan'], data => {
                        const dr = data.deepResearch || {};
                        const plan = data.currentPlan || currentPlan;

                        dr.remaining = remaining;
                        // reset_after가 ISO8601 문자열("2025-06-20T05:20:09.983812+00:00")일 때도 정상 처리
                        dr.resetAt = new Date(resetTime).getTime();

                        const tmpl = (data.planLimitsAll || defaultLimits);
                        const def = tmpl[plan] && tmpl[plan]['deep-research'];
                        dr.total = (def && def.value != null) ? def.value : (dr.total || '?');

                        chrome.storage.local.set({ deepResearch: dr });
                        console.log('💾 Deep Research 정보 저장 완료:', dr);
                    });
                }
            }
        } catch (error) {
            console.error('❌ conversation/init 데이터 처리 실패:', error);
        }
    }
    
    // 2. Fetch Hook에서 캡처한 Deep Research 정보 직접 처리
    if (message.type === 'deep_research_info' && message.info) {
        console.log('🔍 Content script로부터 Deep Research 정보 수신:', message.info);
        
        try {
            const { remaining, reset_after } = message.info;
            
            // storage 업데이트
            chrome.storage.local.get(['deepResearch', 'currentPlan'], data => {
                const dr = data.deepResearch || {};
                const plan = data.currentPlan || currentPlan;
                
                dr.remaining = remaining;
                dr.resetAt = new Date(reset_after).getTime();
                
                const tmpl = (data.planLimitsAll || defaultLimits);
                const def = tmpl[plan] && tmpl[plan]['deep-research'];
                dr.total = (def && def.value != null) ? def.value : (dr.total || '?');
                
                chrome.storage.local.set({ deepResearch: dr });
                console.log('💾 Deep Research 정보 저장 완료 (fetch hook):', dr);
                
                // 배지 업데이트 (선택적)
                if (remaining <= 10) {  // 적은 횟수일 경우 배지에 표시
                    chrome.action.setBadgeText({ text: `DR:${remaining}` });
                    chrome.action.setBadgeBackgroundColor({ color: remaining <= 5 ? '#FF0000' : '#FFA500' });
                }
            });
        } catch (error) {
            console.error('❌ Deep Research 정보 처리 실패:', error);
        }
    }
    if (message.type === 'messageCount' && message.model) {
        console.log('📨 Content script로부터 메시지 카운트 수신:', message.model);
        
        // 기본 updateModelUsage 함수 호출 (background.js.bak 호환성)
        updateModelUsage(message.model);
        
        // 추가로 workspace별 카운팅도 수행
        updateModelUsageWithWorkspace(message.model, message.workspaceId || 'default');
    }
    
    // Deep Research 남은 횟수 저장
    if (message.type === 'deepResearchRemaining') {
        chrome.storage.local.get(['deepResearch', 'currentPlan'], data => {
            const dr = data.deepResearch || {};
            // 남은 횟수 업데이트
            dr.remaining = message.remaining;
            // 플랜에 따른 전체 한도 설정
            const plan = data.currentPlan || currentPlan;
            const tmpl = (data.planLimitsAll || defaultLimits);
            const def = tmpl[plan] && tmpl[plan]['deep-research'];
            dr.total = (def && def.value != null) ? def.value : dr.total;
            // init API body에서 전달된 resetTime(seconds or ISO) 처리
            if (message.resetTime != null) {
                const rt = message.resetTime;
                dr.resetAt = new Date(rt).getTime();
            }
            chrome.storage.local.set({ deepResearch: dr }, () => {
                sendResponse({ status: 'ok' });
            });
        });
        return true;
    }

    // 플랜 변경
    if (message.type === 'changePlan' && message.plan) {
        currentPlan = message.plan;
        chrome.storage.local.get(['planLimitsAll', 'deepResearch'], data2 => {
            const tmpl = data2.planLimitsAll || defaultLimits;
            const newLimits = tmpl[currentPlan] || {};
            const oldDr = (data2.deepResearch || {});
            const dr = {
                remaining: oldDr.remaining ?? '-',
                total: newLimits['deep-research']?.value ?? '-',
                resetAt: oldDr.resetAt ?? getNextMonthlyResetTimestamp()
            };
            chrome.storage.local.set({ limits: newLimits, currentPlan, deepResearch: dr }, () => {
                sendResponse({ status: 'ok' });
            });
        });
        return true;
    }

    // 원격 플랜 한도 즉시 동기화
    if (message.type === 'refreshPlanLimits') {
        (async () => {
            const result = await refreshPlanLimitsFromRemote();
            sendResponse(result);
        })();
        return true;
    }

    return true;
});

// 웹 요청 모니터링은 content script와 fetch/request hook을 통해 대체되었습니다.
// 모델 정보 추출 및 사용량 업데이트는 메시지를 통해 처리됩니다.

// 중복된 updateModelUsage 제거 (timestamps 기반 로직만 유지)

// workspace별 모델 사용량 업데이트 함수
async function updateModelUsageWithWorkspace(model, workspaceId) {
  try {
    const data = await chrome.storage.local.get(['usageCounts', 'limits', 'currentPlan']);
    const counts = data.usageCounts || {};
    const limits = data.limits || defaultLimits[data.currentPlan || 'free'];
    
    // workspace별로 카운트 관리 - 새 배열 기반 시스템
    if (!counts[model]) {
      counts[model] = {
        // 타임스탬프 배열로 모든 요청 시간 저장
        timestamps: []
      };
    }

    // timestamps 배열이 없으면 초기화
    if (!counts[model].timestamps) {
      counts[model].timestamps = [];
    }
    
    // 현재 타임스탬프 추가
    const now = Date.now();
    counts[model].timestamps.push(now);    // 모델의 제한 타입에 따라 현재 사용량 계산
    if (limits[model]) {
      const limitType = limits[model].type;
      const limitValue = limits[model].value;
      
      // 먼저 항상 사용량 저장 (unlimited 여부와 관계없이)
      await chrome.storage.local.set({ usageCounts: counts });
      updateBadge(counts);
      
      // unlimited가 아닌 경우에만 한도 확인 및 경고
      if (limitType !== 'unlimited') {
        // 현재 카운트 계산 - 타임스탬프 배열 기반
        const currentCount = getCountByType(counts[model].timestamps, limitType);
        
        if (limitValue && currentCount >= limitValue * NOTIFY_THRESHOLD) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: '사용량 경고',
            message: `${model} 요청이 ${limitType === 'fiveHour' ? '5시간' : limitType === 'threeHour' ? '3시간' : limitType === 'daily' ? '일일' : limitType === 'weekly' ? '주간' : '월간'} 한도의 ${Math.round(NOTIFY_THRESHOLD*100)}%에 도달했습니다. (${currentCount}/${limitValue})`
          });
        }
      }
    }
  } catch (error) {
    console.error('[Background] 모델 사용량 업데이트 에러:', error);
  }
}

// Deep Research 데이터는 기존 응답 처리 및 content script 메시지로 처리하므로 별도 리스너 불필요

// 뱃지 텍스트 업데이트 (전체 일일 합계)
function updateBadge(counts) {
    let totalDaily = 0;
    for (const model in counts) {
        if (model !== '_lastReset' && counts[model].timestamps) {
            // 각 모델의 일간 카운트 계산 (타임스탬프 배열 기반)
            totalDaily += getCountByType(counts[model].timestamps, 'daily');
        }
    }
    chrome.action.setBadgeText({ text: totalDaily > 0 ? String(totalDaily) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#0078D4' });
}

// 정기적인 데이터 정리 함수 - 오래된 타임스탬프 제거 (6개월 이상)
function cleanupOldData() {
    chrome.storage.local.get('usageCounts', data => {
        const counts = data.usageCounts || {};
        const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000); // 약 6개월
        
        let changed = false;
        
        // 모든 모델에 대해 처리
        for (const model in counts) {
            if (model === '_lastReset') continue;
            
            if (counts[model].timestamps && Array.isArray(counts[model].timestamps)) {
                // 6개월 이전 타임스탬프는 제거
                const newTimestamps = counts[model].timestamps.filter(ts => ts >= sixMonthsAgo);
                
                if (newTimestamps.length !== counts[model].timestamps.length) {
                    counts[model].timestamps = newTimestamps;
                    changed = true;
                }
            }
        }
        
        // 변경된 경우에만 저장
        if (changed) {
            chrome.storage.local.set({ usageCounts: counts });
        }
    });
}

// 초기 뱃지 업데이트
chrome.storage.local.get('usageCounts', data => updateBadge(data.usageCounts || {}));
