(() => {
  const BG = (self.__GURUM_BG__ = self.__GURUM_BG__ || {});

  const REMOTE_LIMITS_URL =
    'https://raw.githubusercontent.com/gurumnyang/chatgpt-gurum-tool/main/config/plan-limits.json';

  const defaultLimits = {
    free: {
      'gpt-5': {
        type: 'fiveHour',
        value: 10,
        displayName: 'GPT-5',
        detect: ['auto', 'gpt-5', 'gpt-5-instant'],
      },
      'gpt-5-thinking': {
        type: 'daily',
        value: 1,
        displayName: 'GPT-5 Thinking',
        detect: ['gpt-5-thinking'],
      },
      'deep-research': { type: 'monthly', value: 5, displayName: 'Deep Research' },
    },
    plus: {
      'gpt-4o': { type: 'threeHour', value: 80, displayName: 'GPT-4o', detect: ['gpt-4o'] },
      'gpt-4-1': { type: 'threeHour', value: 80, displayName: 'GPT-4.1', detect: ['gpt-4-1'] },
      o3: { type: 'weekly', value: 100, displayName: 'o3', detect: ['o3'] },
      'o4-mini': { type: 'daily', value: 300, displayName: 'o4-mini', detect: ['o4-mini'] },
      'gpt-5': {
        type: 'threeHour',
        value: 160,
        displayName: 'GPT-5',
        detect: ['gpt-5', 'gpt-5-instant'],
      },
      'gpt-5-thinking': {
        type: 'weekly',
        value: 200,
        displayName: 'GPT-5 Thinking',
        detect: ['gpt-5-thinking'],
      },
      'gpt-5-t-mini': {
        type: 'weekly',
        value: 2800,
        displayName: 'GPT-5 Thinking mini',
        detect: ['gpt-5-t-mini'],
      },
      'deep-research': { type: 'monthly', value: 25, displayName: 'Deep Research' },
    },
    team: {
      'gpt-4o': { type: 'unlimited', value: null, displayName: 'GPT-4o', detect: ['gpt-4o'] },
      'gpt-4-1': { type: 'threeHour', value: 500, displayName: 'GPT-4.1', detect: ['gpt-4-1'] },
      o3: { type: 'daily', value: 300, displayName: 'o3', detect: ['o3'] },
      'o4-mini': { type: 'daily', value: 300, displayName: 'o4-mini', detect: ['o4-mini'] },
      'gpt-5': {
        type: 'unlimited',
        value: null,
        displayName: 'GPT-5',
        detect: ['gpt-5', 'gpt-5-instant'],
      },
      'gpt-5-thinking': {
        type: 'weekly',
        value: 200,
        displayName: 'GPT-5 Thinking',
        detect: ['gpt-5-thinking'],
      },
      'gpt-5-t-mini': {
        type: 'weekly',
        value: 2800,
        displayName: 'GPT-5 Thinking mini',
        detect: ['gpt-5-t-mini'],
      },
      'gpt-5-pro': { type: 'monthly', value: 15, displayName: 'GPT-5 Pro', detect: ['gpt-5-pro'] },
      'deep-research': { type: 'monthly', value: 25, displayName: 'Deep Research' },
    },
    pro: {
      'gpt-4o': { type: 'unlimited', value: null, displayName: 'GPT-4o', detect: ['gpt-4o'] },
      'gpt-4-1': { type: 'unlimited', value: null, displayName: 'GPT-4.1', detect: ['gpt-4-1'] },
      'gpt-4-5': { type: 'unlimited', value: null, displayName: 'GPT-4.5', detect: ['gpt-4-5'] },
      o3: { type: 'unlimited', value: null, displayName: 'o3', detect: ['o3'] },
      'o4-mini': { type: 'unlimited', value: null, displayName: 'o4-mini', detect: ['o4-mini'] },
      'gpt-5': {
        type: 'unlimited',
        value: null,
        displayName: 'GPT-5',
        detect: ['gpt-5', 'gpt-5-instant'],
      },
      'gpt-5-thinking': {
        type: 'unlimited',
        value: null,
        displayName: 'GPT-5 Thinking',
        detect: ['gpt-5-thinking'],
      },
      'gpt-5-t-mini': {
        type: 'unlimited',
        value: null,
        displayName: 'GPT-5 Thinking mini',
        detect: ['gpt-5-t-mini'],
      },
      'gpt-5-pro': {
        type: 'unlimited',
        value: null,
        displayName: 'GPT-5 Pro',
        detect: ['gpt-5-pro'],
      },
      'deep-research': { type: 'monthly', value: 250, displayName: 'Deep Research' },
    },
  };

  async function fetchRemotePlanLimits() {
    const url = REMOTE_LIMITS_URL;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !data.plans) throw new Error('Invalid plan JSON');
      return data;
    } catch (e) {
      console.warn('원격 플랜 한도 로드 실패:', e);
      return null;
    }
  }

  async function getPlanLimitsTemplate() {
    const data = await chrome.storage.local.get(['planLimitsAll']);
    return data.planLimitsAll || defaultLimits;
  }

  async function getDeepResearchTotalFor(plan) {
    const tmpl = await getPlanLimitsTemplate();
    return tmpl[plan] && tmpl[plan]['deep-research'] && tmpl[plan]['deep-research'].value != null
      ? tmpl[plan]['deep-research'].value
      : '-';
  }

  async function refreshPlanLimitsFromRemote(currentPlanFallback) {
    try {
      const conf = await chrome.storage.local.get(['currentPlan']);
      const plan = conf.currentPlan || currentPlanFallback || 'free';
      const remote = await fetchRemotePlanLimits();
      if (!remote) return { updated: false };
      const planLimitsAll = remote.plans;
      const limits = planLimitsAll[plan] || defaultLimits[plan] || {};

      const now = Date.now();
      await chrome.storage.local.set({ planLimitsAll, limits, lastPlanSyncAt: now });

      chrome.storage.local.get('deepResearch', (data) => {
        const dr = data.deepResearch || {};
        dr.total = planLimitsAll[plan]?.['deep-research']?.value ?? dr.total ?? '-';
        chrome.storage.local.set({ deepResearch: dr });
      });

      if (typeof BG.migrateModelAliases === 'function') {
        await BG.migrateModelAliases(plan);
      }

      return {
        updated: true,
        version: remote.version,
        updatedAt: remote.updatedAt,
        lastSyncAt: now,
      };
    } catch (e) {
      console.warn('원격 플랜 동기화 실패:', e);
      return { updated: false };
    }
  }

  BG.defaultLimits = defaultLimits;
  BG.REMOTE_LIMITS_URL = REMOTE_LIMITS_URL;
  BG.fetchRemotePlanLimits = fetchRemotePlanLimits;
  BG.getPlanLimitsTemplate = getPlanLimitsTemplate;
  BG.getDeepResearchTotalFor = getDeepResearchTotalFor;
  BG.refreshPlanLimitsFromRemote = refreshPlanLimitsFromRemote;
})();
