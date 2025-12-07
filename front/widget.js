(function () {
  if (window.__IFLAME_WIDGET_LOADED__) {
    return;
  }
  window.__IFLAME_WIDGET_LOADED__ = true;

  const scriptEl = document.currentScript;
  const globalConfig = window.IFLAME_WIDGET_CONFIG || {
    apiBaseUrl: 'http://localhost:8000',
    widgetBaseUrl: 'http://localhost:3000'
  };
  const dataset = scriptEl ? scriptEl.dataset : {};

  function normalizeBase(url) {
    if (!url) {
      return window.location.origin;
    }
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  function deriveWidgetBase() {
    if (globalConfig.widgetBaseUrl) {
      return normalizeBase(globalConfig.widgetBaseUrl);
    }
    if (dataset.widgetBase) {
      return normalizeBase(dataset.widgetBase);
    }
    if (scriptEl && scriptEl.src) {
      try {
        const srcUrl = new URL(scriptEl.src, window.location.origin);
        return `${srcUrl.origin}`;
      } catch (e) {
        console.warn('[iflame-widget] Failed to parse script src', e);
      }
    }
    return normalizeBase(window.location.origin);
  }

  function deriveApiBase() {
    if (globalConfig.apiBaseUrl) {
      return normalizeBase(globalConfig.apiBaseUrl);
    }
    if (dataset.apiBase) {
      return normalizeBase(dataset.apiBase);
    }
    return deriveWidgetBase();
  }

  const widgetBase = deriveWidgetBase();
  const apiBase = deriveApiBase();

  function ready(callback) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      callback();
    } else {
      document.addEventListener('DOMContentLoaded', callback);
    }
  }

  function mountWidget(sessionToken) {
    if (document.getElementById('iflame-widget-frame')) {
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'iflame-widget-frame';
    iframe.src = `${widgetBase}/index.html?token=${encodeURIComponent(sessionToken)}&apiBase=${encodeURIComponent(apiBase)}`;
    iframe.style.position = 'fixed';
    iframe.style.right = dataset.right || '20px';
    iframe.style.bottom = dataset.bottom || '20px';
    iframe.style.width = dataset.width || '400px';
    iframe.style.height = dataset.height || '600px';
    iframe.style.border = 'none';
    iframe.style.boxShadow = '0 15px 35px rgba(0,0,0,0.15)';
    iframe.style.borderRadius = '12px';
    iframe.style.zIndex = '2147483647';
    iframe.setAttribute('title', dataset.iframeTitle || 'AI chat widget');

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.id = 'iflame-widget-toggle';
    toggleButton.textContent = dataset.buttonLabel || '💬';
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = dataset.buttonRight || '20px';
    toggleButton.style.bottom = dataset.buttonBottom || '20px';
    toggleButton.style.width = '56px';
    toggleButton.style.height = '56px';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.border = 'none';
    toggleButton.style.background = dataset.buttonColor || '#4a90e2';
    toggleButton.style.color = '#fff';
    toggleButton.style.fontSize = '24px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    toggleButton.style.zIndex = '2147483647';

    toggleButton.addEventListener('click', () => {
      const isHidden = iframe.style.display === 'none';
      iframe.style.display = isHidden ? 'block' : 'none';
      toggleButton.textContent = isHidden ? (dataset.closeLabel || '✕') : (dataset.buttonLabel || '💬');
      if (isHidden) {
        iframe.focus();
      }
    });

    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    document.body.appendChild(toggleButton);
  }

  function requestSessionToken() {
    const payload = {
      host: window.location.host
    };
    return fetch(`${apiBase}/public/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Widget-Host': window.location.host
      },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data.ok) {
          throw new Error('No tenant matched for this domain');
        }
        return data.sessionToken;
      });
  }

  function start() {
    requestSessionToken()
      .then((token) => {
        mountWidget(token);
        window.dispatchEvent(new CustomEvent('iflame-widget-ready'));
      })
      .catch((err) => {
        console.error('[iflame-widget] Failed to initialize widget', err);
        window.dispatchEvent(new CustomEvent('iflame-widget-error', {
          detail: err && err.message ? err.message : String(err)
        }));
      });
  }

  ready(start);
})();
