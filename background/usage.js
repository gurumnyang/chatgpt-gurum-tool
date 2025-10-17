(() => {
  const BG = (self.__GURUM_BG__ = self.__GURUM_BG__ || {});

  const NOTIFY_THRESHOLD = 0.8;

  function getDefaultLimits() {
    return BG.defaultLimits || {};
  }

  function getCountByType(timestamps, type) {
    if (!timestamps || !Array.isArray(timestamps)) return 0;

    const now = Date.now();
    let cutoffTime;

    switch (type) {
      case 'fiveHour':
        cutoffTime = now - 5 * 60 * 60 * 1000;
        break;
      case 'threeHour':
        cutoffTime = now - 3 * 60 * 60 * 1000;
        break;
      case 'daily': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        cutoffTime = today.getTime();
        break;
      }
      case 'weekly': {
        const thisMonday = new Date();
        thisMonday.setHours(0, 0, 0, 0);
        const daysSinceMonday = (thisMonday.getDay() + 6) % 7;
        thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);
        cutoffTime = thisMonday.getTime();
        break;
      }
      case 'monthly': {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        cutoffTime = thisMonth.getTime();
        break;
      }
      default:
        cutoffTime = 0;
    }

    return timestamps.filter((timestamp) => timestamp >= cutoffTime).length;
  }

  function getNextResetTimestamp() {
    const now = new Date();
    const kstMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0),
    );
    if (now.getTime() >= kstMidnight.getTime()) {
      kstMidnight.setUTCDate(kstMidnight.getUTCDate() + 1);
    }
    return kstMidnight.getTime();
  }

  function getNextMonthlyResetTimestamp() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    return next.getTime();
  }

  function resolveCanonicalModel(incomingModel, planLimits, currentPlan) {
    if (!planLimits || typeof planLimits !== 'object') return incomingModel;
    if (planLimits[incomingModel]) return incomingModel;
    try {
      for (const [key, cfg] of Object.entries(planLimits)) {
        if (!cfg || typeof cfg !== 'object') continue;
        const list = Array.isArray(cfg.detect) ? cfg.detect : [];
        if (list.includes(incomingModel)) return key;
      }
      const fallbackPlan = currentPlan || 'free';
      const fallback = getDefaultLimits()[fallbackPlan] || {};
      for (const [key, cfg] of Object.entries(fallback)) {
        if (!cfg || typeof cfg !== 'object') continue;
        const list = Array.isArray(cfg.detect) ? cfg.detect : [];
        if (list.includes(incomingModel)) return key;
      }
    } catch {}
    return incomingModel;
  }

  async function updateModelUsageWithWorkspace(model) {
    try {
      const data = await chrome.storage.local.get(['usageCounts', 'limits', 'currentPlan']);
      const counts = data.usageCounts || {};
      const plan = data.currentPlan || 'free';
      const limits = data.limits || getDefaultLimits()[plan] || {};

      const canonical = resolveCanonicalModel(model, limits, plan);

      if (!counts[canonical]) {
        counts[canonical] = { timestamps: [] };
      }

      if (!counts[canonical].timestamps) {
        counts[canonical].timestamps = [];
      }

      counts[canonical].timestamps.push(Date.now());

      await chrome.storage.local.set({ usageCounts: counts });
      updateBadge(counts);

      if (limits[canonical]) {
        const limitType = limits[canonical].type;
        const limitValue = limits[canonical].value;
        if (limitType !== 'unlimited') {
          const currentCount = getCountByType(counts[canonical].timestamps, limitType);
          if (limitValue && currentCount >= limitValue * NOTIFY_THRESHOLD) {
            const translator = BG.t || ((id) => id);
            const limitLabel = BG.getLimitLabel || (() => '');
            const title = translator('usage_warning_title');
            const percent = String(Math.round(NOTIFY_THRESHOLD * 100));
            const msg = translator('usage_warning_message', [
              canonical,
              limitLabel(limitType),
              percent,
              String(currentCount),
              String(limitValue),
            ]);
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon48.png',
              title: title || 'Usage Warning',
              message: msg,
            });
          }
        }
      }
    } catch (error) {
      console.error('[Background] 모델 사용량 업데이트 에러:', error);
    }
  }

  function updateBadge(counts) {
    let totalDaily = 0;
    for (const model in counts) {
      if (model !== '_lastReset' && counts[model].timestamps) {
        totalDaily += getCountByType(counts[model].timestamps, 'daily');
      }
    }
    chrome.action.setBadgeText({ text: totalDaily > 0 ? String(totalDaily) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#0078D4' });
  }

  function cleanupOldData() {
    chrome.storage.local.get('usageCounts', (data) => {
      const counts = data.usageCounts || {};
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;

      let changed = false;
      for (const model in counts) {
        if (model === '_lastReset') continue;

        if (counts[model].timestamps && Array.isArray(counts[model].timestamps)) {
          const newTimestamps = counts[model].timestamps.filter((ts) => ts >= sixMonthsAgo);

          if (newTimestamps.length !== counts[model].timestamps.length) {
            counts[model].timestamps = newTimestamps;
            changed = true;
          }
        }
      }

      if (changed) {
        chrome.storage.local.set({ usageCounts: counts });
      }
    });
  }

  BG.getCountByType = getCountByType;
  BG.getNextResetTimestamp = getNextResetTimestamp;
  BG.getNextMonthlyResetTimestamp = getNextMonthlyResetTimestamp;
  BG.resolveCanonicalModel = resolveCanonicalModel;
  BG.updateModelUsageWithWorkspace = updateModelUsageWithWorkspace;
  BG.updateBadge = updateBadge;
  BG.cleanupOldData = cleanupOldData;
  BG.NOTIFY_THRESHOLD = NOTIFY_THRESHOLD;
})();
