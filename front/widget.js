(function () {
  if (window.__IFRAME_WIDGET_LOADED__) {
    return;
  }
  window.__IFRAME_WIDGET_LOADED__ = true;

  const scriptEl = document.currentScript;
  const globalConfig = window.IFRAME_WIDGET_CONFIG || {
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
        console.warn('[iframe-widget] Failed to parse script src', e);
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
    if (document.getElementById('iframe-widget-frame')) {
      return;
    }

    // モバイル判定
    const isMobile = window.innerWidth <= 768;

    // ---- ここから配置計算用の値 ----
    // ボタンのサイズ（直径）
    // デフォルトを少し大きめにして、絵文字と見た目を強調する
    // モバイルではさらに大きくする
    const defaultButtonSize = isMobile ? '72' : '64';
    const buttonSize = parseInt(dataset.buttonSize || defaultButtonSize, 10);
    // ボタンの bottom（px）
    const buttonBottom = parseInt(dataset.buttonBottom || '20', 10);
    // ボタンと iframe の隙間
    const gap = parseInt(dataset.gap || '16', 10);

    // iframe の bottom を計算
    // data-bottom が指定されていればそれを優先し、
    // なければ「ボタンの上 + gap」に配置する
    const iframeBottom = dataset.bottom
      ? parseInt(dataset.bottom, 10)
      : buttonBottom + buttonSize + gap;
    // ---- ここまで ----

    const iframe = document.createElement('iframe');
    iframe.id = 'iframe-widget-frame';
    iframe.src = `${widgetBase}/index.html?token=${encodeURIComponent(sessionToken)}&apiBase=${encodeURIComponent(apiBase)}`;
    iframe.style.position = 'fixed';
    iframe.style.right = dataset.right || (isMobile ? '10px' : '20px');
    iframe.style.bottom = iframeBottom + 'px'; // ★ ボタンより上に配置
    iframe.style.width = dataset.width || (isMobile ? 'calc(100vw - 20px)' : '400px');
    iframe.style.height = dataset.height || (isMobile ? 'calc(100vh - 150px)' : '600px');
    iframe.style.border = 'none';
    iframe.style.boxShadow = '0 15px 35px rgba(0,0,0,0.15)';
    iframe.style.borderRadius = '12px';
    iframe.style.zIndex = '2147483647';
    iframe.setAttribute('title', dataset.iframeTitle || 'AI chat widget');

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.id = 'iframe-widget-toggle';
    toggleButton.textContent = dataset.buttonLabel || '💬';
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = dataset.buttonRight || '20px';
    toggleButton.style.bottom = dataset.buttonBottom || '20px';
    toggleButton.style.width = buttonSize + 'px';
    toggleButton.style.height = buttonSize + 'px';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.border = 'none';
    toggleButton.style.background = dataset.buttonColor || '#4a90e2';
    toggleButton.style.color = '#fff';
    toggleButton.style.fontSize = isMobile ? '32px' : '28px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    toggleButton.style.zIndex = '2147483647';

    // メッセージバナーの作成
    const messageBanner = document.createElement('div');
    messageBanner.id = 'iframe-widget-banner';
    messageBanner.style.position = 'fixed';
    messageBanner.style.right = dataset.buttonRight || '20px';
    messageBanner.style.bottom = (buttonBottom + buttonSize + gap) + 'px'; // ボタンの上に配置
    messageBanner.style.background = '#4dd0e1';
    messageBanner.style.color = '#000';
    messageBanner.style.padding = '12px 16px';
    messageBanner.style.borderRadius = '8px';
    messageBanner.style.display = 'flex';
    messageBanner.style.alignItems = 'center';
    messageBanner.style.gap = '12px';
    messageBanner.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    messageBanner.style.zIndex = '2147483647';
    messageBanner.style.maxWidth = isMobile ? 'calc(100vw - 40px)' : '300px';
    messageBanner.style.fontSize = isMobile ? '16px' : '15px';
    messageBanner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    messageBanner.style.padding = isMobile ? '14px 18px' : '12px 16px';

    // バナーアイコン
    const bannerIcon = document.createElement('svg');
    const iconSize = isMobile ? '28px' : '24px';
    bannerIcon.style.width = iconSize;
    bannerIcon.style.height = iconSize;
    bannerIcon.style.flexShrink = '0';
    bannerIcon.style.color = '#000';
    bannerIcon.setAttribute('viewBox', '0 0 24 24');
    bannerIcon.setAttribute('fill', 'none');
    bannerIcon.setAttribute('stroke', 'currentColor');
    bannerIcon.setAttribute('stroke-width', '2');
    const iconPath = document.createElement('path');
    iconPath.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
    bannerIcon.appendChild(iconPath);

    // バナーテキスト
    const bannerText = document.createElement('span');
    bannerText.textContent = 'チャットで質問できます！';
    bannerText.style.flex = '1';
    bannerText.style.color = '#000';
    bannerText.style.fontSize = isMobile ? '16px' : '15px';

    // バナーの閉じるボタン
    const bannerClose = document.createElement('button');
    bannerClose.textContent = '×';
    bannerClose.style.background = 'none';
    bannerClose.style.border = 'none';
    bannerClose.style.color = '#000';
    bannerClose.style.cursor = 'pointer';
    const closeSize = isMobile ? '28px' : '24px';
    bannerClose.style.fontSize = isMobile ? '24px' : '20px';
    bannerClose.style.padding = '0';
    bannerClose.style.width = closeSize;
    bannerClose.style.height = closeSize;
    bannerClose.style.display = 'flex';
    bannerClose.style.alignItems = 'center';
    bannerClose.style.justifyContent = 'center';
    bannerClose.style.flexShrink = '0';
    bannerClose.setAttribute('aria-label', '閉じる');
    bannerClose.addEventListener('mouseenter', () => {
      bannerClose.style.opacity = '0.7';
    });
    bannerClose.addEventListener('mouseleave', () => {
      bannerClose.style.opacity = '1';
    });

    messageBanner.appendChild(bannerIcon);
    messageBanner.appendChild(bannerText);
    messageBanner.appendChild(bannerClose);

    // バナーの閉じるボタンのイベント
    bannerClose.addEventListener('click', () => {
      messageBanner.style.display = 'none';
    });

    toggleButton.addEventListener('click', () => {
      const isHidden = iframe.style.display === 'none';
      iframe.style.display = isHidden ? 'block' : 'none';
      toggleButton.textContent = isHidden
        ? (dataset.closeLabel || '✕')
        : (dataset.buttonLabel || '💬');
      
      if (isHidden) {
        // チャットを開く
        messageBanner.style.display = 'none'; // チャットを開いたらバナーを非表示（永久に）
        iframe.focus();
      }
    });

    iframe.style.display = 'none';
    // 初期状態: バナーは表示、チャットは非表示
    messageBanner.style.display = 'flex';
    
    document.body.appendChild(iframe);
    document.body.appendChild(toggleButton);
    document.body.appendChild(messageBanner);
  }

  function requestSessionToken() {
    // セキュリティ: ホスト情報はサーバー側でOriginヘッダーから取得するため、
    // リクエストボディやカスタムヘッダーには含めない
    return fetch(`${apiBase}/public/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
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
        window.dispatchEvent(new CustomEvent('iframe-widget-ready'));
      })
      .catch((err) => {
        console.error('[iframe-widget] Failed to initialize widget', err);
        window.dispatchEvent(new CustomEvent('iframe-widget-error', {
          detail: err && err.message ? err.message : String(err)
        }));
      });
  }

  ready(start);
})();
