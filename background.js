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
  getPlanLimitsTemplate,
  getDeepResearchTotalFor,
  isValidDeepResearchCount,
  isAllowedPlan,
  parseDeepResearchResetTimestamp,
  updateModelUsageWithWorkspace,
  updateBadge,
  cleanupOldData,
  isConversationSendEndpoint,
  bgLoadLocaleDict,
  migrateModelAliases,
  migrateO4MiniHigh,
  migratePolicy2025_08,
} = self.__GURUM_BG__;

let currentPlan = 'free';

async function getPersistedCurrentPlan() {
  const stored = await chrome.storage.local.get('currentPlan');
  const plan = isAllowedPlan(stored.currentPlan) ? stored.currentPlan : 'free';
  currentPlan = plan;
  return plan;
}

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

      if (isAllowedPlan(prefs.currentPlan)) {
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
        const planLimitsTemplate = await getPlanLimitsTemplate();
        const drTotal = await getDeepResearchTotalFor(currentPlan);
        const initialDr = {
          remaining: '-',
          total: drTotal,
          resetAt: null,
        };
        await chrome.storage.local.set({
          usageCounts: {},
          limits: planLimitsTemplate[currentPlan] || defaultLimits[currentPlan],
          currentPlan: currentPlan,
          deepResearch: initialDr,
          imageGeneration: { remaining: '-', resetAt: null },
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
    const plan = await getPersistedCurrentPlan();

    const { userLocale } = await chrome.storage.local.get('userLocale');
    await bgLoadLocaleDict(userLocale);

    chrome.alarms.create('refreshPlanLimits', { periodInMinutes: 6 * 60 });

    try {
      await refreshPlanLimitsFromRemote(plan);
      await migrateModelAliases(plan);
      await migrateO4MiniHigh();
      await migratePolicy2025_08(plan);
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
  if (area === 'local' && changes.currentPlan && isAllowedPlan(changes.currentPlan.newValue)) {
    currentPlan = changes.currentPlan.newValue;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupData') {
    cleanupOldData();
    chrome.storage.local.get('usageCounts', (data) => {
      updateBadge(data.usageCounts || {});
    });
  } else if (alarm.name === 'refreshPlanLimits') {
    (async () => {
      const plan = await getPersistedCurrentPlan();
      await refreshPlanLimitsFromRemote(plan);
      await migrateModelAliases(plan);
    })().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'deep_research_info' && message.info) {
    console.log('🔍 Content script로부터 Deep Research 정보 수신:', message.info);

    try {
      const { remaining, reset_after } = message.info;
      const hasReset = reset_after !== null && reset_after !== undefined && reset_after !== '';
      const resetAt = hasReset ? parseDeepResearchResetTimestamp(reset_after) : null;
      if (!isValidDeepResearchCount(remaining) || (hasReset && resetAt === null)) {
        console.warn('유효하지 않은 Deep Research 정보 무시:', message.info);
        sendResponse({ status: 'invalid' });
        return false;
      }

      (async () => {
        const data = await chrome.storage.local.get([
          'deepResearch',
          'currentPlan',
          'planLimitsAll',
        ]);
        const dr = data.deepResearch || {};
        const plan = isAllowedPlan(data.currentPlan) ? data.currentPlan : 'free';

        dr.remaining = remaining;
        dr.resetAt = resetAt;

        const tmpl = data.planLimitsAll || (await getPlanLimitsTemplate());
        const def = tmpl[plan] && tmpl[plan]['deep-research'];
        dr.total = def && def.value != null ? def.value : '?';
        dr.updatedAt = Date.now();

        await chrome.storage.local.set({ deepResearch: dr });
        console.log('💾 Deep Research 정보 저장 완료 (fetch hook):', dr);

        if (remaining <= 10) {
          chrome.action.setBadgeText({ text: `DR:${remaining}` });
          chrome.action.setBadgeBackgroundColor({ color: remaining <= 5 ? '#FF0000' : '#FFA500' });
        }
        sendResponse({ status: 'ok' });
      })().catch((error) => {
        console.warn('Deep Research 정보 저장 실패:', error);
        sendResponse({ status: 'error' });
      });
      return true;
    } catch (error) {
      console.error('❌ Deep Research 정보 처리 실패:', error);
      sendResponse({ status: 'error' });
      return false;
    }
  }

  if (message.type === 'image_generation_info' && message.info) {
    try {
      const { remaining, reset_after } = message.info;
      const hasReset = reset_after !== null && reset_after !== undefined && reset_after !== '';
      const resetAt = hasReset ? parseDeepResearchResetTimestamp(reset_after) : null;
      if (!isValidDeepResearchCount(remaining) || (hasReset && resetAt === null)) {
        sendResponse({ status: 'invalid' });
        return false;
      }

      (async () => {
        await chrome.storage.local.set({
          imageGeneration: {
            remaining,
            resetAt,
            updatedAt: Date.now(),
          },
        });
        sendResponse({ status: 'ok' });
      })().catch((error) => {
        console.warn('Image Generation 잔여량 저장 실패:', error);
        sendResponse({ status: 'error' });
      });
      return true;
    } catch (error) {
      console.warn('Image Generation 정보 처리 실패:', error);
      sendResponse({ status: 'error' });
      return false;
    }
  }

  if (message.type === 'deepResearchRemaining') {
    if (!isValidDeepResearchCount(message.remaining)) {
      sendResponse({ status: 'invalid' });
      return false;
    }
    const resetAt =
      message.resetTime == null ? null : parseDeepResearchResetTimestamp(message.resetTime);
    if (message.resetTime != null && resetAt === null) {
      sendResponse({ status: 'invalid' });
      return false;
    }

    (async () => {
      try {
        const data = await chrome.storage.local.get([
          'deepResearch',
          'currentPlan',
          'planLimitsAll',
        ]);
        const dr = data.deepResearch || {};
        dr.remaining = message.remaining;
        const plan = isAllowedPlan(data.currentPlan) ? data.currentPlan : 'free';
        const tmpl = data.planLimitsAll || (await getPlanLimitsTemplate());
        const def = tmpl[plan] && tmpl[plan]['deep-research'];
        dr.total = def && def.value != null ? def.value : '?';
        if (resetAt !== null) dr.resetAt = resetAt;
        dr.updatedAt = Date.now();
        await chrome.storage.local.set({ deepResearch: dr });
        sendResponse({ status: 'ok' });
      } catch (error) {
        console.warn('Deep Research 잔여량 저장 실패:', error);
        sendResponse({ status: 'error' });
      }
    })();
    return true;
  }

  if (message.type === 'changePlan' && message.plan) {
    if (!isAllowedPlan(message.plan)) {
      sendResponse({ status: 'invalid' });
      return false;
    }
    currentPlan = message.plan;
    (async () => {
      try {
        const data2 = await chrome.storage.local.get(['planLimitsAll', 'deepResearch']);
        const tmpl = data2.planLimitsAll || (await getPlanLimitsTemplate());
        const newLimits = tmpl[currentPlan] || {};
        const oldDr = data2.deepResearch || {};
        const dr = {
          remaining: oldDr.remaining ?? '-',
          total: newLimits['deep-research']?.value ?? '?',
          resetAt: parseDeepResearchResetTimestamp(oldDr.resetAt),
        };
        await chrome.storage.local.set({ limits: newLimits, currentPlan, deepResearch: dr });
        sendResponse({ status: 'ok' });
      } catch (error) {
        console.warn('플랜 변경 저장 실패:', error);
        sendResponse({ status: 'error' });
      }
    })();
    return true;
  }

  if (message.type === 'refreshPlanLimits') {
    (async () => {
      try {
        const plan = await getPersistedCurrentPlan();
        const result = await refreshPlanLimitsFromRemote(plan);
        await migrateModelAliases(plan);
        sendResponse(result);
      } catch (error) {
        console.warn('플랜 동기화 메시지 처리 실패:', error);
        sendResponse({ updated: false });
      }
    })();
    return true;
  }

  return false;
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
        if (!isConversationSendEndpoint(details.url)) return;

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
