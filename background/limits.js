(() => {
  const BG = (self.__GURUM_BG__ = self.__GURUM_BG__ || {});

  const REMOTE_LIMITS_URL =
    'https://raw.githubusercontent.com/gurumnyang/chatgpt-gurum-tool/main/config/plan-limits.json';
  const PACKAGED_LIMITS_PATH = 'config/plan-limits.json';
  const ALLOWED_PLANS = new Set(['free', 'plus', 'team', 'pro']);
  const ALLOWED_LIMIT_TYPES = new Set([
    'fiveHour',
    'threeHour',
    'daily',
    'weekly',
    'monthly',
    'unlimited',
  ]);
  // 원격 설정의 목적상 새 모델 키는 코드 릴리스 없이 추가될 수 있어야 한다.
  // 알려진 이름의 고정 목록 대신 안전한 canonical-key 문법을 허용한다.
  const MODEL_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/;
  const DETECT_VALUE_PATTERN = /^(?:auto|[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?)$/;
  const MAX_LIMIT_VALUE = 1_000_000_000;
  const MIN_RESET_TIMESTAMP = Date.UTC(2020, 0, 1);
  const MAX_RESET_TIMESTAMP = Date.UTC(2100, 0, 1);

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

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function hasOnlyKeys(value, allowedKeys) {
    return Object.keys(value).every((key) => allowedKeys.has(key));
  }

  function isPlainDisplayName(value) {
    const hasUnsafeCharacter =
      typeof value === 'string' &&
      (/[<>&]/.test(value) ||
        Array.from(value).some((character) => {
          const codePoint = character.codePointAt(0);
          return codePoint <= 31 || codePoint === 127;
        }));
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 80 &&
      value === value.trim() &&
      !hasUnsafeCharacter
    );
  }

  function validateLimitEntry(modelKey, entry) {
    if (!MODEL_KEY_PATTERN.test(modelKey) || !isPlainObject(entry)) return false;
    if (!hasOnlyKeys(entry, new Set(['type', 'value', 'displayName', 'detect']))) return false;
    if (!ALLOWED_LIMIT_TYPES.has(entry.type) || !isPlainDisplayName(entry.displayName)) {
      return false;
    }

    const valueIsValid =
      entry.value === null ||
      (Number.isSafeInteger(entry.value) && entry.value >= 0 && entry.value <= MAX_LIMIT_VALUE);
    if (!valueIsValid) return false;
    if ((entry.type === 'unlimited') !== (entry.value === null)) return false;

    if (entry.detect !== undefined) {
      if (!Array.isArray(entry.detect) || entry.detect.length === 0 || entry.detect.length > 32) {
        return false;
      }
      const uniqueValues = new Set();
      for (const detectValue of entry.detect) {
        if (
          typeof detectValue !== 'string' ||
          !DETECT_VALUE_PATTERN.test(detectValue) ||
          uniqueValues.has(detectValue)
        ) {
          return false;
        }
        uniqueValues.add(detectValue);
      }
    }

    return true;
  }

  function validatePlanLimitsDocument(data) {
    if (!isPlainObject(data) || !isPlainObject(data.plans)) return null;
    if (!hasOnlyKeys(data, new Set(['version', 'updatedAt', 'plans']))) return null;
    if (data.version !== undefined && !isPlainDisplayName(data.version)) return null;
    if (data.updatedAt !== undefined && !isPlainDisplayName(data.updatedAt)) return null;

    const planNames = Object.keys(data.plans);
    if (planNames.length !== ALLOWED_PLANS.size) return null;
    for (const plan of planNames) {
      const models = data.plans[plan];
      if (!ALLOWED_PLANS.has(plan) || !isPlainObject(models) || Object.keys(models).length === 0) {
        return null;
      }
      for (const [modelKey, entry] of Object.entries(models)) {
        if (!validateLimitEntry(modelKey, entry)) return null;
      }
    }

    return data;
  }

  function validateStoredPlanLimits(plans) {
    return validatePlanLimitsDocument({ plans })?.plans || null;
  }

  let packagedLimitsPromise;

  async function loadPackagedPlanLimits() {
    if (!packagedLimitsPromise) {
      packagedLimitsPromise = (async () => {
        try {
          const url = chrome.runtime.getURL(PACKAGED_LIMITS_PATH);
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const validated = validatePlanLimitsDocument(await res.json());
          if (!validated) throw new Error('Invalid packaged plan JSON');
          return validated.plans;
        } catch (e) {
          console.warn('패키지 플랜 한도 로드 실패:', e);
          return null;
        }
      })();
    }
    return packagedLimitsPromise;
  }

  async function fetchRemotePlanLimits() {
    const url = REMOTE_LIMITS_URL;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const validated = validatePlanLimitsDocument(await res.json());
      if (!validated) throw new Error('Invalid remote plan JSON');
      return validated;
    } catch (e) {
      console.warn('원격 플랜 한도 로드 실패:', e);
      return null;
    }
  }

  async function getPlanLimitsTemplate() {
    const data = await chrome.storage.local.get(['planLimitsAll']);
    const storedLimits = validateStoredPlanLimits(data.planLimitsAll);
    if (storedLimits) return storedLimits;
    return (await loadPackagedPlanLimits()) || defaultLimits;
  }

  async function getDeepResearchTotalFor(plan) {
    const tmpl = await getPlanLimitsTemplate();
    const value = tmpl[plan]?.['deep-research']?.value;
    return isValidDeepResearchCount(value) ? value : '-';
  }

  function isValidDeepResearchCount(value) {
    return Number.isSafeInteger(value) && value >= 0 && value <= MAX_LIMIT_VALUE;
  }

  function isAllowedPlan(plan) {
    return typeof plan === 'string' && ALLOWED_PLANS.has(plan);
  }

  function parseDeepResearchResetTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) &&
      timestamp >= MIN_RESET_TIMESTAMP &&
      timestamp <= MAX_RESET_TIMESTAMP
      ? timestamp
      : null;
  }

  async function refreshPlanLimitsFromRemote(currentPlanFallback) {
    try {
      const conf = await chrome.storage.local.get(['currentPlan']);
      const candidatePlan = conf.currentPlan || currentPlanFallback;
      const plan = isAllowedPlan(candidatePlan) ? candidatePlan : 'free';
      const remote = await fetchRemotePlanLimits();
      if (!remote) return { updated: false };
      const planLimitsAll = remote.plans;
      const packagedLimits = (await loadPackagedPlanLimits()) || defaultLimits;
      const limits = planLimitsAll[plan] || packagedLimits[plan] || {};

      const now = Date.now();
      await chrome.storage.local.set({ planLimitsAll, limits, lastPlanSyncAt: now });

      chrome.storage.local.get('deepResearch', (data) => {
        const dr = data.deepResearch || {};
        const total = planLimitsAll[plan]?.['deep-research']?.value;
        dr.total = isValidDeepResearchCount(total) ? total : (dr.total ?? '-');
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
  BG.loadPackagedPlanLimits = loadPackagedPlanLimits;
  BG.validatePlanLimitsDocument = validatePlanLimitsDocument;
  BG.getPlanLimitsTemplate = getPlanLimitsTemplate;
  BG.getDeepResearchTotalFor = getDeepResearchTotalFor;
  BG.isValidDeepResearchCount = isValidDeepResearchCount;
  BG.isAllowedPlan = isAllowedPlan;
  BG.parseDeepResearchResetTimestamp = parseDeepResearchResetTimestamp;
  BG.refreshPlanLimitsFromRemote = refreshPlanLimitsFromRemote;
})();
