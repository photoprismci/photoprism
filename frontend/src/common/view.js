import { toRaw, reactive } from "vue";

const TouchStartEvent = "touchstart";
const TouchMoveEvent = "touchmove";

// If true, logging is enabled.
const log = window.__CONFIG__?.develop && typeof console?.log == "function";

// getHtmlElement returns the <html> element.
export function getHtmlElement() {
  return document.getElementsByTagName("html")[0];
}

// initHtmlElement initializes the <html> element by removing the "class" attribute.
export function initHtmlElement() {
  const el = document.getElementsByTagName("html")[0];

  if (el && el.hasAttribute("class")) {
    if (log) {
      console.log(`html: removed class="${el.getAttribute("class")}"`);
    }

    // Remove the class="loading" attribute from <html> when the application has loaded.
    el.removeAttribute("class");

    // If requested, hide the scrollbar permanently by adding class="hide-scrollbar" to <html>.
    if (document.body.classList.contains("hide-scrollbar")) {
      document.body.classList.remove("hide-scrollbar");
      el.setAttribute("class", "hide-scrollbar");

      if (log) {
        console.log('html: added class="hide-scrollbar" to permanently hide the scrollbar');
      }
    }
  }
}

// getBodyElement returns the <body>> element.
export function getBodyElement() {
  return document.body;
}

// isInputElement checks if the element is a button.
export function isInputElement(el) {
  if (!el) {
    return false;
  }

  return el instanceof HTMLButtonElement;
}

// isMediaElement checks if the element is an image, video, or canvas.
export function isMediaElement(el) {
  if (!el) {
    return false;
  }

  return el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement;
}

// preventNavigationTouchEvent prevents the default navigation touch gestures.
export function preventNavigationTouchEvent(ev) {
  if (ev instanceof TouchEvent && ev.cancelable) {
    // console.log(`${ev.type} @ ${ev.touches[0].clientX.toString()} x ${ev.touches[0].clientY.toString()}`, ev.target);
    if (ev.type === TouchStartEvent && (isMediaElement(ev.target) || ev.touches[0].clientX <= 30)) {
      if (window.innerHeight - ev.touches[0].clientY > 128 || ev.touches[0].clientX <= 30) {
        ev.preventDefault();
        // console.log(`prevented ${ev.type} @ ${ev.touches[0].clientX.toString()} x ${ev.touches[0].clientY.toString()}`);
      }
    } else if (ev.type === TouchMoveEvent && !isInputElement(ev.target)) {
      ev.preventDefault();
      // console.log(`prevented ${ev.type} @ ${ev.touches[0].clientX.toString()} x ${ev.touches[0].clientY.toString()}`);
    }
  }
}

// generateRandomId returns a random string that can be used as an identifier.
export function generateRandomId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 18);
}

// View keeps track of the visible components and dialogs,
// and updates the window and <html> body as needed.
export class View {
  // Initializes the instance properties with the default values.
  constructor() {
    this.uid = 0;
    this.scopes = [];
    this.preventNavigation = false;
  }

  // Changes the view context to the specified component,
  // and updates the window and <html> body as needed.
  enter(c) {
    if (!c) {
      return;
    }

    if (this.isRoot()) {
      initHtmlElement();
    }

    this.scopes.push(c);

    this.apply(c);

    return this.scopes.length;
  }

  // Returns to the parent view context of the specified component,
  // and updates the window and <html> body as needed.
  leave(c) {
    if (this.scopes.length === 0) {
      return;
    }

    if (c) {
      const i = this.scopes.findLastIndex((s) => s === c);
      if (i >= 0) {
        this.scopes.splice(i);
      }
    } else {
      this.scopes.pop();
    }

    if (this.scopes.length) {
      this.apply(this.scopes[this.scopes.length - 1]);
    }

    return this.scopes.length;
  }

  // Updates the window and the <html> body elements based on the specified component.
  apply(c) {
    if (!c || typeof c !== "object" || !Number.isInteger(c?.$?.uid)) {
      console?.warn(`view: invalid component passed to apply (#${this.uid.toString()})`, c);
      return;
    }

    const htmlEl = getHtmlElement();

    if (!htmlEl) {
      console?.warn(`view: failed to get HTML element (#${this.uid.toString()})`, c);
      return;
    }

    const bodyEl = getBodyElement();

    if (!bodyEl) {
      console?.warn(`view: failed to get BODY element (#${this.uid.toString()})`, c);
      return;
    }

    // Get the component's numeric unique ID, if any.
    const uid = c.$.uid;

    // Return, as it should not be necessary to apply the same state twice.
    if (this.uid === uid) {
      return;
    }

    const name = c?.$options?.name ? c.$options.name : "";

    // let hideOverflow = false;
    let hideScrollbar = false;
    let preventNavigation = uid > 0 && !name.startsWith("PPage");
    let disableNavigationGestures = false;

    switch (name) {
      case "PPageLogin":
        // hideOverflow = window.$isMobile;
        break;
      case "PPhotoEditDialog":
      case "PPhotoUploadDialog":
        // hideOverflow = true;
        hideScrollbar = true;
        preventNavigation = true;
        break;
      case "PLightbox":
        // hideOverflow = true;
        hideScrollbar = true;
        preventNavigation = true;
        disableNavigationGestures = true;
        break;
    }

    this.preventNavigation = preventNavigation;

    if (log && name && uid) {
      const scope = this.scopes.map((s) => `${s?.$options?.name} #${s?.$?.uid.toString()}`).join(" › ");
      console.log(`view: ${scope}`, toRaw(c.$data));
    }

    if (hideScrollbar) {
      if (!bodyEl.classList.contains("hide-scrollbar")) {
        bodyEl.classList.add("hide-scrollbar");
        if (log) {
          console.log(`body: added class="hide-scrollbar"`);
        }
      }
    } else {
      if (bodyEl.classList.contains("hide-scrollbar")) {
        bodyEl.classList.remove("hide-scrollbar");
        if (log) {
          console.log(`body: removed class="hide-scrollbar"`);
        }
      }
    }

    if (disableNavigationGestures) {
      if (!bodyEl.classList.contains("disable-navigation-gestures")) {
        bodyEl.classList.add("disable-navigation-gestures");
        document.addEventListener(TouchStartEvent, preventNavigationTouchEvent, { passive: false });
        document.addEventListener(TouchMoveEvent, preventNavigationTouchEvent, { passive: false });
        if (log) {
          console.log(`view: disabled touch navigation gestures`);
        }
      }
    } else if (bodyEl.classList.contains("disable-navigation-gestures")) {
      bodyEl.classList.remove("disable-navigation-gestures");
      document.removeEventListener(TouchStartEvent, preventNavigationTouchEvent, false);
      document.removeEventListener(TouchMoveEvent, preventNavigationTouchEvent, false);
      if (log) {
        console.log(`view: re-enabled touch navigation gestures`);
      }
    }
  }

  // Returns the currently active view component or null if none exists.
  current() {
    if (this.scopes.length) {
      return this.scopes[this.scopes.length - 1];
    } else {
      return null;
    }
  }

  // Returns the currently active view data or an empty reactive object otherwise.
  data() {
    if (this.scopes.length) {
      return this.scopes[this.scopes.length - 1]?.$data;
    } else {
      return reactive({});
    }
  }

  // Returns true if the specified view component is currently inactive, e.g. hidden in the background.
  isHidden(c) {
    return !this.isVisible(c);
  }

  // Returns true if the specified view component is currently active, e.g. visible in the foreground.
  isVisible(c) {
    if (!c || this.isApp()) {
      return true;
    }

    const context = this.scopes[this.scopes.length - 1];

    if (typeof c === "object") {
      return c === context;
    } else if (typeof c === "string") {
      return context?.$options?.name === c;
    } else if (typeof c === "number") {
      return context?.$?.uid === c;
    }

    return false;
  }

  // Returns true if no view is currently active.
  isRoot() {
    return !this.scopes.length;
  }

  // Returns true if no view or the main view of the app is currently active.
  isApp() {
    if (this.isRoot()) {
      return true;
    }

    const c = this.scopes[this.scopes.length - 1];

    return c?.$options?.name === "App" || c?.$?.uid === 0;
  }
}

// $view is the default View instance.
export const $view = new View();
