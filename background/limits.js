(() => {
  const BG = (self.__GURUM_BG__ = self.__GURUM_BG__ || {});

  const REMOTE_LIMITS_URL =
    'https://raw.githubusercontent.com/gurumnyang/chatgpt-gurum-tool/main/config/plan-limits.json';
  const PACKAGED_LIMITS_PATH = 'config/plan-limits.json';
  const ALLOWED_PLANS = new Set(['free', 'go', 'plus', 'team', 'pro']);
  const ALLOWED_LIMIT_TYPES = new Set([
    'fiveHour',
    'threeHour',
    'daily',
    'weekly',
    'monthly',
    'unlimited',
    'dynamic',
  ]);
  // 원격 설정의 목적상 새 모델 키는 코드 릴리스 없이 추가될 수 있어야 한다.
  // 알려진 이름의 고정 목록 대신 안전한 canonical-key 문법을 허용한다.
  const MODEL_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/;
  const DETECT_VALUE_PATTERN = /^(?:auto|[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?)$/;
  const MAX_LIMIT_VALUE = 1_000_000_000;
  const MIN_RESET_TIMESTAMP = Date.UTC(2020, 0, 1);
  const MAX_RESET_TIMESTAMP = Date.UTC(2100, 0, 1);

  const instant = (type, value, includeAuto = false) => ({
    type,
    value,
    displayName: 'GPT-5.5 Instant',
    detect: [
      ...(includeAuto ? ['auto'] : []),
      'gpt-5.5',
      'gpt-5.5-instant',
      'gpt-5-5',
      'gpt-5-5-instant',
    ],
  });
  const legacyInstant = (type, value) => ({
    type,
    value,
    displayName: 'GPT-5.3 Instant',
    detect: ['gpt-5.3', 'gpt-5.3-instant', 'gpt-5-3', 'gpt-5-3-instant'],
  });
  const meteredSol = {
    type: 'weekly',
    value: 3000,
    displayName: 'GPT-5.6 Sol',
    detect: [
      'gpt-5.6',
      'gpt-5-6',
      'gpt-5.6-sol',
      'gpt-5-6-sol',
      'gpt-5.6-thinking',
      'gpt-5-6-thinking',
    ],
  };
  const meteredSolPro = {
    type: 'monthly',
    value: 15,
    displayName: 'GPT-5.6 Sol Pro',
    detect: ['gpt-5.6-pro', 'gpt-5-6-pro'],
  };
  const thinking = (type, value) => ({
    type,
    value,
    displayName: 'GPT-5.5 Thinking',
    detect: ['gpt-5.5-thinking', 'gpt-5-5-thinking'],
  });
  const pro = (type, value) => ({
    type,
    value,
    displayName: 'GPT-5.5 Pro',
    detect: ['gpt-5.5-pro', 'gpt-5-5-pro'],
  });
  const deepResearch = (value) => ({
    type: 'monthly',
    value,
    displayName: 'Deep Research',
  });
  const defaultLimits = {
    free: {
      'gpt-5-5-instant': instant('dynamic', null, true),
      'deep-research': deepResearch(5),
    },
    go: {
      'gpt-5-5-instant': instant('threeHour', 160, true),
      'gpt-5-3-instant': legacyInstant('threeHour', 160),
      'gpt-5-5-thinking': thinking('fiveHour', 10),
      'deep-research': deepResearch(5),
    },
    plus: {
      'gpt-5-5-instant': instant('threeHour', 160),
      'gpt-5-6-sol': meteredSol,
      'gpt-5-3-instant': legacyInstant('threeHour', 160),
      'gpt-5-5-thinking': thinking('weekly', 3000),
      o3: { type: 'weekly', value: 100, displayName: 'o3', detect: ['o3'] },
      'deep-research': deepResearch(25),
    },
    team: {
      'gpt-5-5-instant': instant('unlimited', null),
      'gpt-5-6-sol': meteredSol,
      'gpt-5-6-pro': meteredSolPro,
      'gpt-5-3-instant': legacyInstant('unlimited', null),
      'gpt-5-5-thinking': thinking('weekly', 3000),
      'gpt-5-5-pro': pro('monthly', 15),
      o3: { type: 'daily', value: 300, displayName: 'o3', detect: ['o3'] },
      'deep-research': deepResearch(25),
    },
    pro: {
      'gpt-5-5-instant': instant('unlimited', null),
      'gpt-5-6-sol': { ...meteredSol, type: 'unlimited', value: null },
      'gpt-5-6-pro': { ...meteredSolPro, type: 'unlimited', value: null },
      'gpt-5-3-instant': legacyInstant('unlimited', null),
      'gpt-5-5-thinking': thinking('unlimited', null),
      'gpt-5-5-pro': pro('unlimited', null),
      o3: { type: 'unlimited', value: null, displayName: 'o3', detect: ['o3'] },
      'deep-research': deepResearch(250),
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
    const hasUnknownNumericLimit = entry.type === 'unlimited' || entry.type === 'dynamic';
    if (hasUnknownNumericLimit !== (entry.value === null)) return false;

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

  async function loadPackagedPlanLimitsDocument() {
    if (!packagedLimitsPromise) {
      packagedLimitsPromise = (async () => {
        try {
          const url = chrome.runtime.getURL(PACKAGED_LIMITS_PATH);
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const validated = validatePlanLimitsDocument(await res.json());
          if (!validated) throw new Error('Invalid packaged plan JSON');
          return validated;
        } catch (e) {
          console.warn('패키지 플랜 한도 로드 실패:', e);
          return null;
        }
      })();
    }
    return packagedLimitsPromise;
  }

  async function loadPackagedPlanLimits() {
    return (await loadPackagedPlanLimitsDocument())?.plans || null;
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
    const data = await chrome.storage.local.get(['planLimitsAll', 'planLimitsUpdatedAt']);
    const storedLimits = validateStoredPlanLimits(data.planLimitsAll);
    const packaged = await loadPackagedPlanLimitsDocument();
    const storedTimestamp = parseDocumentTimestamp(data.planLimitsUpdatedAt);
    const packagedTimestamp = parseDocumentTimestamp(packaged?.updatedAt);
    if (storedLimits && (!packaged || storedTimestamp >= packagedTimestamp)) return storedLimits;
    return packaged?.plans || storedLimits || defaultLimits;
  }

  async function getDeepResearchTotalFor(plan) {
    const tmpl = await getPlanLimitsTemplate();
    const value = tmpl[plan]?.['deep-research']?.value;
    return isValidDeepResearchCount(value) ? value : '?';
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

  function parseDocumentTimestamp(value) {
    if (typeof value !== 'string') return 0;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  async function refreshPlanLimitsFromRemote(currentPlanFallback) {
    try {
      const conf = await chrome.storage.local.get(['currentPlan']);
      const candidatePlan = conf.currentPlan || currentPlanFallback;
      const plan = isAllowedPlan(candidatePlan) ? candidatePlan : 'free';
      const [remote, packaged, stored] = await Promise.all([
        fetchRemotePlanLimits(),
        loadPackagedPlanLimitsDocument(),
        chrome.storage.local.get(['planLimitsAll', 'planLimitsVersion', 'planLimitsUpdatedAt']),
      ]);
      const storedPlans = validateStoredPlanLimits(stored.planLimitsAll);
      const candidates = [remote, packaged];
      if (storedPlans) {
        candidates.push({
          plans: storedPlans,
          version: stored.planLimitsVersion,
          updatedAt: stored.planLimitsUpdatedAt,
        });
      }
      const selected = candidates
        .filter(Boolean)
        .sort(
          (a, b) => parseDocumentTimestamp(b.updatedAt) - parseDocumentTimestamp(a.updatedAt),
        )[0];
      if (!selected) return { updated: false };
      const planLimitsAll = selected.plans;
      const packagedLimits = packaged?.plans || defaultLimits;
      const limits = planLimitsAll[plan] || packagedLimits[plan] || {};

      const now = Date.now();
      await chrome.storage.local.set({
        planLimitsAll,
        planLimitsVersion: selected.version,
        planLimitsUpdatedAt: selected.updatedAt,
        limits,
        lastPlanSyncAt: now,
      });

      chrome.storage.local.get('deepResearch', (data) => {
        const dr = data.deepResearch || {};
        const total = planLimitsAll[plan]?.['deep-research']?.value;
        dr.total = isValidDeepResearchCount(total) ? total : '?';
        chrome.storage.local.set({ deepResearch: dr });
      });

      if (typeof BG.migrateModelAliases === 'function') {
        await BG.migrateModelAliases(plan);
      }

      return {
        updated: true,
        version: selected.version,
        updatedAt: selected.updatedAt,
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
