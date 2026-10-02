/**
 * Anti-UI Automation Security Module
 * 
 * Mandates:
 * - HIPAA § 164.312(b) "Audit and Integrity Controls"
 * - OWASP A07: Identification and Authentication Failures
 * - OWASP Automated Threats to Web Applications (OAT-006, OAT-019)
 * 
 * Protects Alaga clinical telemetry and patient health record interfaces by:
 * 1. Detecting active automated browser drivers (WebDriver, Selenium, Puppeteer, Playwright, Headless Chrome).
 * 2. Intercepting and blocking untrusted/synthetic DOM events (simulated clicks, keystrokes, form submissions).
 * 3. Providing continuous runtime monitoring against dynamically attached automation hooks.
 */

export interface AutomationDetectionResult {
  isAutomated: boolean;
  reason: string | null;
}

// Global window extensions for automation fingerprinting
declare global {
  interface Window {
    __webdriver_evaluate?: unknown;
    __selenium_evaluate?: unknown;
    __webdriver_script_fn?: unknown;
    __driver_evaluate?: unknown;
    __webdriver_script_func?: unknown;
    __webdriver_script_function?: unknown;
    _Selenium_IDE_Recorder?: unknown;
    _selenium?: unknown;
    calledSelenium?: unknown;
    __fxdriver_evaluate?: unknown;
    __nightmare?: unknown;
    _phantom?: unknown;
    phantom?: unknown;
    callPhantom?: unknown;
    domAutomation?: unknown;
    domAutomationController?: unknown;
    __playwright?: unknown;
    __puppeteer_evaluation_script__?: unknown;
    Cypress?: unknown;
  }
}

/**
 * Checks for WebDriver, automated browser properties, and headless signatures.
 */
export function detectUIAutomation(): AutomationDetectionResult {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isAutomated: false, reason: null };
  }

  // 1. Standard W3C navigator.webdriver flag
  if (navigator.webdriver === true) {
    return {
      isAutomated: true,
      reason: 'W3C navigator.webdriver automation flag is enabled on this browser instance.',
    };
  }

  // 2. Automation framework globals & driver signatures
  const win = window as any;
  const doc = document as any;

  if (
    win.__webdriver_evaluate ||
    win.__selenium_evaluate ||
    win.__webdriver_script_fn ||
    win.__driver_evaluate ||
    win.__webdriver_script_func ||
    win.__webdriver_script_function ||
    win._Selenium_IDE_Recorder ||
    win._selenium ||
    win.calledSelenium ||
    win.__fxdriver_evaluate
  ) {
    return {
      isAutomated: true,
      reason: 'Selenium / WebDriver browser automation hook detected in global scope.',
    };
  }

  if (win.__playwright || win.__puppeteer_evaluation_script__) {
    return {
      isAutomated: true,
      reason: 'Puppeteer / Playwright headless automation runtime detected.',
    };
  }

  if (win._phantom || win.phantom || win.callPhantom || win.__nightmare) {
    return {
      isAutomated: true,
      reason: 'PhantomJS / Nightmare headless automation environment detected.',
    };
  }

  if (win.domAutomation || win.domAutomationController) {
    return {
      isAutomated: true,
      reason: 'Chrome DOM automation controller interface active.',
    };
  }

  if (win.Cypress) {
    return {
      isAutomated: true,
      reason: 'Cypress automated test runner detected in window context.',
    };
  }

  // 3. Document-level ChromeDriver fingerprints
  if (
    doc.$cdc_asdjflasutopfhvcZLmcfl_ ||
    doc.__webdriver_script_fn ||
    doc.documentElement?.getAttribute('webdriver') !== null
  ) {
    return {
      isAutomated: true,
      reason: 'ChromeDriver binary signature ($cdc) detected on document root.',
    };
  }

  // 4. Headless User-Agent signature
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('headlesschrome') || ua.includes('phantomjs') || ua.includes('selenium')) {
    return {
      isAutomated: true,
      reason: 'Headless automation User-Agent header detected.',
    };
  }

  // 5. Inhuman navigator property anomalies (typical headless giveaways)
  if (
    ua.includes('chrome') &&
    !ua.includes('edge') &&
    !ua.includes('opr') &&
    navigator.languages &&
    navigator.languages.length === 0
  ) {
    return {
      isAutomated: true,
      reason: 'Anomalous browser language configuration characteristic of headless automation.',
    };
  }

  return { isAutomated: false, reason: null };
}

/**
 * Global Synthetic Event Blocker
 * 
 * Captures all user interaction events in the capture phase.
 * If event.isTrusted is false (event was dispatched programmatically via script
 * like element.click() or dispatchEvent()), the event is immediately blocked.
 */
export function installSyntheticEventBlocker(
  onBlocked?: (eventType: string, targetTag: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const monitoredEvents = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'submit',
    'keydown',
    'keypress',
    'keyup',
    'change',
  ];

  const handler = (event: Event) => {
    // isTrusted is true ONLY when the event was generated by a genuine user action
    // (physical mouse click, keyboard keypress, touch tap).
    if (event.isTrusted === false) {
      const target = event.target as HTMLElement | null;

      // EXEMPTION 1: Legitimate client-side file download triggers (e.g. dynamic <a download> blob anchors)
      if (target && (target instanceof HTMLAnchorElement || target.tagName.toLowerCase() === 'a')) {
        const anchor = target as HTMLAnchorElement;
        if (anchor.hasAttribute('download') || (anchor.href && (anchor.href.startsWith('blob:') || anchor.href.startsWith('data:')))) {
          return;
        }
      }

      // EXEMPTION 2: File input pickers triggered by upload button clicks (e.g. avatar/firmware file selector)
      if (target && (target instanceof HTMLInputElement || target.tagName.toLowerCase() === 'input')) {
        const input = target as HTMLInputElement;
        if (input.type === 'file') {
          return;
        }
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const targetTag = target ? target.tagName.toLowerCase() : 'unknown';

      console.warn(
        `[ALAGA SECURITY] Blocked synthetic/automated ${event.type} event on <${targetTag}>. Direct UI automation is prohibited.`
      );

      if (onBlocked) {
        onBlocked(event.type, targetTag);
      }
    }
  };

  // Attach in capture phase so synthetic events are rejected before reaching any component listeners
  monitoredEvents.forEach((evt) => {
    window.addEventListener(evt, handler, { capture: true, passive: false });
  });

  // Cleanup function
  return () => {
    monitoredEvents.forEach((evt) => {
      window.removeEventListener(evt, handler, { capture: true });
    });
  };
}
