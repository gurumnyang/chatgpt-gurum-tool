(() => {
  const BG = (self.__GURUM_BG__ = self.__GURUM_BG__ || {});

  let localeDict = null;
  let localeCode = 'system'; // 'system' | 'ko' | 'en'

  async function bgLoadLocaleDict(code) {
    try {
      if (!code || code === 'system') {
        localeDict = null;
        localeCode = 'system';
        return;
      }
      const url = chrome.runtime.getURL(`_locales/${code}/messages.json`);
      const res = await fetch(url);
      if (res.ok) {
        localeDict = await res.json();
        localeCode = code;
      } else {
        localeDict = null;
        localeCode = 'system';
      }
    } catch {
      localeDict = null;
      localeCode = 'system';
    }
  }

  function t(id, subs) {
    try {
      if (localeDict && localeDict[id] && localeDict[id].message) {
        let s = localeDict[id].message;
        const arr = Array.isArray(subs) ? subs : [];
        arr.forEach((v, i) => {
          s = s.replace(new RegExp('\\$' + (i + 1), 'g'), v);
        });
        return s;
      }
      return chrome.i18n.getMessage(id, subs || []) || id;
    } catch {
      return id;
    }
  }

  function getLimitLabel(limitType) {
    switch (limitType) {
      case 'fiveHour':
        return t('limit_label_fiveHour');
      case 'threeHour':
        return t('limit_label_threeHour');
      case 'daily':
        return t('limit_label_daily');
      case 'weekly':
        return t('limit_label_weekly');
      case 'monthly':
        return t('limit_label_monthly');
      default:
        return '';
    }
  }

  BG.bgLoadLocaleDict = bgLoadLocaleDict;
  BG.t = t;
  BG.getLimitLabel = getLimitLabel;
  BG.getCurrentLocaleCode = () => localeCode;
})();
