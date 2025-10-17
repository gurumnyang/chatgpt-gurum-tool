(() => {
  const BG = (self.__GURUM_BG__ = self.__GURUM_BG__ || {});

  function getDefaultLimits() {
    return BG.defaultLimits || {};
  }

  async function migratePolicy2025_08(currentPlanFallback) {
    try {
      const data = await chrome.storage.local.get([
        'usageCounts',
        'limits',
        'currentPlan',
        'planLimitsAll',
      ]);
      const counts = data.usageCounts || {};
      let limits = data.limits || {};
      const plan = data.currentPlan || currentPlanFallback || 'free';
      const planTmpl = data.planLimitsAll || getDefaultLimits();

      if (counts['gpt-4-1-mini']) delete counts['gpt-4-1-mini'];
      if (limits['gpt-4-1-mini']) delete limits['gpt-4-1-mini'];

      if ((plan === 'plus' || plan === 'team') && limits['gpt-4-5']) {
        delete limits['gpt-4-5'];
      }

      if (plan === 'team') {
        limits = { ...(planTmpl.team || {}) };
      } else if (plan === 'plus') {
        limits['gpt-5'] = { type: 'threeHour', value: 160 };
        limits['gpt-5-thinking'] = { type: 'weekly', value: 3000 };
      } else if (plan === 'free') {
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

  async function migrateO4MiniHigh() {
    try {
      const data = await chrome.storage.local.get(['usageCounts', 'limits']);
      const counts = data.usageCounts || {};
      const limits = data.limits || {};

      if (counts['o4-mini-high']) {
        const src = counts['o4-mini-high'];
        const dst = counts['o4-mini'] || {};

        if (src.timestamps || dst.timestamps) {
          const a = Array.isArray(dst.timestamps) ? dst.timestamps : [];
          const b = Array.isArray(src.timestamps) ? src.timestamps : [];
          const merged = Array.from(new Set([...(a || []), ...(b || [])])).sort();
          dst.timestamps = merged;
        }

        dst.daily = (dst.daily || 0) + (src.daily || 0);
        dst.monthly = (dst.monthly || 0) + (src.monthly || 0);
        dst.threeHour = (dst.threeHour || 0) + (src.threeHour || 0);

        counts['o4-mini'] = dst;
        delete counts['o4-mini-high'];
      }

      if (limits['o4-mini-high']) {
        delete limits['o4-mini-high'];
      }

      await chrome.storage.local.set({ usageCounts: counts, limits });
    } catch (e) {
      console.warn('o4-mini-high 마이그레이션 실패:', e);
    }
  }

  async function migrateModelAliases(currentPlanFallback) {
    try {
      const data = await chrome.storage.local.get(['usageCounts', 'planLimitsAll', 'currentPlan']);
      const counts = data.usageCounts || {};
      const tmplAll = data.planLimitsAll || getDefaultLimits();
      const plan = data.currentPlan || currentPlanFallback || 'free';
      const planLimits = tmplAll[plan] || {};

      let changed = false;
      const aliasToCanonical = {};
      for (const [key, cfg] of Object.entries(planLimits)) {
        const list = Array.isArray(cfg?.detect) ? cfg.detect : [];
        for (const alias of list) {
          if (alias !== key) aliasToCanonical[alias] = key;
        }
      }

      for (const [alias, canonical] of Object.entries(aliasToCanonical)) {
        if (counts[alias]) {
          const src = counts[alias];
          const dst = counts[canonical] || {};
          const a = Array.isArray(dst.timestamps) ? dst.timestamps : [];
          const b = Array.isArray(src.timestamps) ? src.timestamps : [];
          const merged = Array.from(new Set([...(a || []), ...(b || [])])).sort();
          dst.timestamps = merged;

          dst.daily = (dst.daily || 0) + (src.daily || 0);
          dst.monthly = (dst.monthly || 0) + (src.monthly || 0);
          dst.threeHour = (dst.threeHour || 0) + (src.threeHour || 0);

          counts[canonical] = dst;
          delete counts[alias];
          changed = true;
        }
      }

      if (changed) await chrome.storage.local.set({ usageCounts: counts });
    } catch (e) {
      console.warn('모델 alias 마이그레이션 실패:', e);
    }
  }

  BG.migratePolicy2025_08 = migratePolicy2025_08;
  BG.migrateO4MiniHigh = migrateO4MiniHigh;
  BG.migrateModelAliases = migrateModelAliases;
})();
