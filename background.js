console.log('Background script running.');

self.__GURUM_BG__ = self.__GURUM_BG__ || {};
self.importScripts(
  'background/limits.js',
  'background/i18n.js',
  'background/usage.js',
  'background/migrations.js',
);

const {
  defaultLimits,
  refreshPlanLimitsFromRemote,
  getDeepResearchTotalFor,
  getNextMonthlyResetTimestamp,
  updateModelUsageWithWorkspace,
  updateBadge,
  cleanupOldData,
  bgLoadLocaleDict,
  migrateModelAliases,
  migrateO4MiniHigh,
  migratePolicy2025_08,
} = self.__GURUM_BG__;

let currentPlan = 'free';

chrome.runtime.onInstalled.addListener((details) => {
  (async () => {
    try {
      const reason = details?.reason;
      const installedReasonEnum = chrome.runtime.OnInstalledReason || {};
      const isFreshInstall =
        reason === installedReasonEnum.INSTALL || (!reason && installedReasonEnum.INSTALL == null);

      const prefs = await chrome.storage.local.get([
        '__prefsInitialized',
        'showTimestamps',
        'timestampFormat',
        'hoverToolbarTone',
        'hoverToolbarIncludeTimestamp',
        'currentPlan',
      ]);

      const needPrefsInit = !prefs.__prefsInitialized;
      const installReasonIsInstall = reason === installedReasonEnum.INSTALL;
      const shouldInitializeDefaults = installReasonIsInstall || needPrefsInit;

      if (prefs.currentPlan) {
        currentPlan = prefs.currentPlan;
      }

      if (shouldInitializeDefaults) {
        const updates = { __prefsInitialized: true };

        if (prefs.showTimestamps === undefined) {
          updates.showTimestamps = true;
        }

        if (!prefs.timestampFormat) {
          updates.timestampFormat = 'standard';
        }

        if (!prefs.hoverToolbarTone) {
          updates.hoverToolbarTone = 'neutral';
        }

        if (typeof prefs.hoverToolbarIncludeTimestamp !== 'boolean') {
          updates.hoverToolbarIncludeTimestamp = false;
        }

        await chrome.storage.local.set(updates);
      }

      if (reason === installedReasonEnum.UPDATE) {
        try {
          const { version } = chrome.runtime.getManifest();
          chrome.notifications.create('gurum-update-notice', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '구름툴이 업데이트되었습니다',
            message: `(${version})으로 자동 업데이트 되었어요. 새로운 기능과 개선 사항을 확인해보세요!`,
            priority: 1,
          });
        } catch (e) {
          console.warn('업데이트 알림 생성 실패:', e);
        }
      }

      const { userLocale } = await chrome.storage.local.get('userLocale');
      await bgLoadLocaleDict(userLocale);

      if (isFreshInstall) {
        const drTotal = await getDeepResearchTotalFor(currentPlan);
        const initialDr = {
          remaining: '-',
          total: drTotal || '-',
          resetAt: getNextMonthlyResetTimestamp(),
        };
        await chrome.storage.local.set({
          usageCounts: {},
          limits: defaultLimits[currentPlan],
          currentPlan: currentPlan,
          deepResearch: initialDr,
        });
      }
    } catch (error) {
      console.warn('초기 환경 설정 실패:', error);
    }

    chrome.alarms.create('cleanupData', { periodInMinutes: 24 * 60 });
    chrome.alarms.create('refreshPlanLimits', { periodInMinutes: 6 * 60 });

    try {
      await refreshPlanLimitsFromRemote(currentPlan);
      await migrateModelAliases(currentPlan);
      await migrateO4MiniHigh();
      await migratePolicy2025_08(currentPlan);
    } catch (error) {
      console.warn('초기 동기화 및 마이그레이션 실패:', error);
    }
  })();
});

chrome.runtime.onStartup.addListener(() => {
  (async () => {
    const stored = await chrome.storage.local.get('currentPlan');
    if (stored?.currentPlan) {
      currentPlan = stored.currentPlan;
    }

    const { userLocale } = await chrome.storage.local.get('userLocale');
    await bgLoadLocaleDict(userLocale);

    chrome.alarms.create('refreshPlanLimits', { periodInMinutes: 6 * 60 });

    try {
      await refreshPlanLimitsFromRemote(currentPlan);
      await migrateModelAliases(currentPlan);
      await migrateO4MiniHigh();
      await migratePolicy2025_08(currentPlan);
    } catch (error) {
      console.warn('시작 시 동기화 실패:', error);
    }
  })();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.userLocale) {
    const v = changes.userLocale.newValue;
    bgLoadLocaleDict(v);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupData') {
    cleanupOldData();
    chrome.storage.local.get('usageCounts', (data) => {
      updateBadge(data.usageCounts || {});
    });
  } else if (alarm.name === 'refreshPlanLimits') {
    refreshPlanLimitsFromRemote(currentPlan)
      .catch(() => {})
      .finally(() => {
        migrateModelAliases(currentPlan).catch(() => {});
      });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'deep_research_info' && message.info) {
    console.log('🔍 Content script로부터 Deep Research 정보 수신:', message.info);

    try {
      const { remaining, reset_after } = message.info;

      chrome.storage.local.get(['deepResearch', 'currentPlan'], (data) => {
        const dr = data.deepResearch || {};
        const plan = data.currentPlan || currentPlan;

        dr.remaining = remaining;
        dr.resetAt = new Date(reset_after).getTime();

        const tmpl = data.planLimitsAll || defaultLimits;
        const def = tmpl[plan] && tmpl[plan]['deep-research'];
        dr.total = def && def.value != null ? def.value : dr.total || '?';

        chrome.storage.local.set({ deepResearch: dr });
        console.log('💾 Deep Research 정보 저장 완료 (fetch hook):', dr);

        if (remaining <= 10) {
          chrome.action.setBadgeText({ text: `DR:${remaining}` });
          chrome.action.setBadgeBackgroundColor({ color: remaining <= 5 ? '#FF0000' : '#FFA500' });
        }
      });
    } catch (error) {
      console.error('❌ Deep Research 정보 처리 실패:', error);
    }
  }

  if (message.type === 'deepResearchRemaining') {
    chrome.storage.local.get(['deepResearch', 'currentPlan'], (data) => {
      const dr = data.deepResearch || {};
      dr.remaining = message.remaining;
      const plan = data.currentPlan || currentPlan;
      const tmpl = data.planLimitsAll || defaultLimits;
      const def = tmpl[plan] && tmpl[plan]['deep-research'];
      dr.total = def && def.value != null ? def.value : dr.total;
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

  if (message.type === 'changePlan' && message.plan) {
    currentPlan = message.plan;
    chrome.storage.local.get(['planLimitsAll', 'deepResearch'], (data2) => {
      const tmpl = data2.planLimitsAll || defaultLimits;
      const newLimits = tmpl[currentPlan] || {};
      const oldDr = data2.deepResearch || {};
      const dr = {
        remaining: oldDr.remaining ?? '-',
        total: newLimits['deep-research']?.value ?? '-',
        resetAt: oldDr.resetAt ?? getNextMonthlyResetTimestamp(),
      };
      chrome.storage.local.set({ limits: newLimits, currentPlan, deepResearch: dr }, () => {
        sendResponse({ status: 'ok' });
      });
    });
    return true;
  }

  if (message.type === 'refreshPlanLimits') {
    (async () => {
      try {
        const result = await refreshPlanLimitsFromRemote(currentPlan);
        await migrateModelAliases(currentPlan);
        sendResponse(result);
      } catch (error) {
        console.warn('플랜 동기화 메시지 처리 실패:', error);
        sendResponse({ updated: false });
      }
    })();
    return true;
  }

  return true;
});

try {
  const URL_FILTERS = [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://*.openai.com/*',
  ];

  chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
      try {
        if (details.method !== 'POST') return;
        const u = details.url || '';
        const test = new URL(u).pathname;
        if (!/^\/backend-api\/(?:f\/)?conversation(?:\/)?$/.test(test)) return;

        const rb = details.requestBody;
        let bodyText = '';
        if (rb?.raw && Array.isArray(rb.raw) && rb.raw.length > 0) {
          const totalLen = rb.raw.reduce((sum, p) => sum + (p.bytes ? p.bytes.byteLength : 0), 0);
          const buf = new Uint8Array(totalLen);
          let offset = 0;
          for (const part of rb.raw) {
            if (part.bytes) {
              const view = new Uint8Array(part.bytes);
              buf.set(view, offset);
              offset += view.byteLength;
            }
          }
          bodyText = new TextDecoder('utf-8').decode(buf);
        } else if (rb?.formData) {
          const modelField = rb.formData.model;
          if (Array.isArray(modelField) && modelField[0]) {
            updateModelUsageWithWorkspace(modelField[0], 'default');
            return;
          }
        }

        if (!bodyText) return;
        let model = null;
        try {
          const obj = JSON.parse(bodyText);
          model = obj?.model || null;
        } catch {}
        if (!model) return;
        updateModelUsageWithWorkspace(model, 'default');
      } catch (e) {
        // 관찰 전용: 에러는 무시
      }
    },
    { urls: URL_FILTERS },
    ['requestBody'],
  );
} catch (e) {
  console.warn('webRequest 초기화 실패:', e);
}

chrome.storage.local.get('usageCounts', (data) => updateBadge(data.usageCounts || {}));
