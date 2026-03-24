/**
 * Builds the JavaScript code to inject react-grab into a webview guest page.
 *
 * Strategy: inject a <script> tag that loads react-grab from the npm package's
 * global build (served via unpkg CDN as a fallback-safe approach), then register
 * a pi-code plugin that sends element context back to the host via console.log
 * with a unique prefix.
 *
 * The host BrowserView listens for `console-message` events and parses messages
 * with this prefix to extract the grabbed context.
 */

export const REACT_GRAB_MESSAGE_PREFIX = '__PI_REACT_GRAB__:'

/**
 * JavaScript to execute inside the webview after dom-ready.
 * This injects react-grab and registers a plugin to relay grabbed context.
 */
export function getReactGrabInjectionScript(): string {
  return `
(function() {
  // Prevent double-injection
  if (window.__PI_REACT_GRAB_INJECTED__) return;
  window.__PI_REACT_GRAB_INJECTED__ = true;

  function registerPiPlugin() {
    var api = window.__REACT_GRAB__;
    if (!api) return;
    try {
      api.registerPlugin({
        name: 'pi-code',
        hooks: {
          onAfterCopy: function(elements, success) {
            if (!success) return;
          },
          transformCopyContent: function(content, elements) {
            // Send the content to the host via console message channel
            try {
              console.log('${REACT_GRAB_MESSAGE_PREFIX}' + JSON.stringify({
                type: 'element-grabbed',
                content: content
              }));
            } catch (e) {
              // Ignore serialization errors
            }
            return content;
          }
        }
      });
    } catch (e) {
      console.warn('[pi-code] Failed to register react-grab plugin:', e);
    }
  }

  // If react-grab is already loaded (unlikely on first inject), register immediately
  if (window.__REACT_GRAB__) {
    registerPiPlugin();
    return;
  }

  // Load react-grab via script tag
  var script = document.createElement('script');
  script.src = 'https://unpkg.com/react-grab@latest/dist/index.global.js';
  script.crossOrigin = 'anonymous';
  script.onload = function() {
    // react-grab auto-initializes on load and sets window.__REACT_GRAB__
    // Also listen for the init event as a fallback
    if (window.__REACT_GRAB__) {
      registerPiPlugin();
    } else {
      window.addEventListener('react-grab:init', function() {
        registerPiPlugin();
      }, { once: true });
    }
  };
  script.onerror = function() {
    console.warn('[pi-code] Failed to load react-grab from CDN');
  };
  document.head.appendChild(script);
})();
`
}
