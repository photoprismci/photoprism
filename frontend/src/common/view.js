import { toRaw } from "vue";

const TouchStartEvent = "touchstart";
const TouchMoveEvent = "touchmove";

// True if debug and/or trace logs should be recorded.
const debug = window.__CONFIG__?.debug;
const trace = window.__CONFIG__?.trace;

// Returns the <html> element.
export function getHtmlElement() {
  return document.documentElement;
}

// Initializes the <html> element by removing the "class" attribute.
export function initHtmlElement() {
  const htmlElement = document.documentElement;

  if (htmlElement && htmlElement.hasAttribute("class")) {
    if (debug) {
      console.log(`html: removed class="${htmlElement.getAttribute("class")}"`);
    }

    // Remove the class="loading" attribute from <html> when the application has loaded.
    htmlElement.removeAttribute("class");
    htmlElement.setAttribute("style", "");

    // If requested, hide the scrollbar permanently by adding class="hide-scrollbar" to <html>.
    if (document.body.classList.contains("hide-scrollbar")) {
      htmlElement.setAttribute("class", "hide-scrollbar");

      if (debug) {
        console.log('html: added class="hide-scrollbar" to permanently hide the scrollbar');
      }
    }
  }
}
// Set a :root style variable, or removes it if the value is empty.
export function setHtmlStyle(key, value) {
  if (!key) {
    return false;
  }

  const htmlElement = getHtmlElement();

  if (!htmlElement) {
    return false;
  } else if (value) {
    htmlElement.style.setProperty(key, value);
  } else {
    htmlElement.style.removeProperty(key);
  }

  return true;
}

// Returns the <body>> element.
export function getBodyElement() {
  return document.body;
}

// Checks if the element is a button.
export function isInputElement(el) {
  if (!el) {
    return false;
  }

  return el instanceof HTMLButtonElement;
}

// Checks if the element is an image, video, or canvas.
export function isMediaElement(el) {
  if (!el) {
    return false;
  }

  return el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement;
}

// Returns the most likely focus element for the given component, or null if none exists.
export function getFocusElement(c) {
  if (!c) {
    return null;
  }

  if (c.$refs) {
    let ref;

    if (c.$refs.form) {
      ref = c.$refs.form;
    } else if (c.$refs.content) {
      ref = c.$refs.content;
    } else if (c.$refs.container) {
      ref = c.$refs.container;
    } else if (c.$refs.dialog) {
      ref = c.$refs.dialog;
    }

    if (ref && ref instanceof HTMLElement) {
      return ref;
    } else if (ref && ref.$el instanceof HTMLElement) {
      return ref.$el;
    } else if (c.$refs.dialog) {
      return document.querySelector(".v-overlay-container .v-overlay__content");
    }
  }

  if (c.$el) {
    if (c.$el.getAttribute && c.$el.getAttribute("tabindex") === "1") {
      return c.$el;
    }

    if (c.$el.parentElement) {
      return c.$el.parentElement.querySelector('[tabindex="1"]');
    }
  }

  return null;
}

// Prevents the default navigation touch gestures.
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

// Returns a random string that can be used as an identifier.
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

    if (trace) {
      document.addEventListener("focusin", (ev) => {
        console.debug("focus: ", ev.target);
      });
    }
  }

  // Changes the view context to the specified component,
  // and updates the window and <html> body as needed.
  enter(c) {
    if (!c) {
      return false;
    }

    if (this.isRoot()) {
      initHtmlElement();
    }

    if (c !== this.current()) {
      this.scopes.push(c);
    }

    this.apply(c);

    return this.scopes.length;
  }

  // Returns to the parent view context of the specified component,
  // and updates the window and <html> body as needed.
  leave(c) {
    if (!c || this.scopes.length === 0) {
      return false;
    }

    const index = this.scopes.findLastIndex((s) => s === c);

    if (index > 0) {
      this.scopes.splice(index, 1);
    } else if (index < 0) {
      return;
    }

    if (this.scopes.length) {
      this.apply(this.scopes[this.scopes.length - 1]);
    }

    return this.scopes.length;
  }

  // Updates the window and the <html> body elements based on the specified component.
  apply(c) {
    if (!c || typeof c !== "object" || !Number.isInteger(c?.$?.uid) || !c.$el) {
      console.log(`view: invalid component (#${this.uid.toString()})`, c);
      return false;
    }

    // Get the component's name and numeric ID.
    const name = c?.$options?.name ? c.$options.name : "";
    const uid = c.$.uid;

    if (!name) {
      console.log(`view: component needs a name (#${uid})`, c);
      return false;
    }

    // If debug mode is enabled, create a new log group in the browser console:
    // https://developer.mozilla.org/en-US/docs/Web/API/console/groupCollapsed_static
    if (debug) {
      const scope = this.scopes.map((s) => `${s?.$options?.name} #${s?.$?.uid.toString()}`).join(" ▶ ");
      console.groupCollapsed(
        `%c${scope}`,
        "background: #502A85; color: white; padding: 2px 6px; border-radius: 8px; font-weight: bold;"
      );
      console.log("data:", toRaw(c?.$data));
    }

    // Automatically focus the active component if its element tabindex attribute is set to "1":
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
    const focusElement = getFocusElement(c);

    if (focusElement && focusElement instanceof HTMLElement) {
      try {
        focusElement.focus({ preventScroll: true });
      } catch (err) {
        console.log(`focus: ${err}`, focusElement);
      }
    }

    // Return, as it should not be necessary to apply the same state twice.
    if (this.uid === uid) {
      if (debug) {
        console.groupEnd();
      }
      return;
    }

    let hideScrollbar = false;
    let disableScrolling = false;
    let disableNavigationGestures = false;
    let preventNavigation = uid > 0 && !name.startsWith("PPage");

    switch (name) {
      case "PPagePlaces":
        hideScrollbar = true;
        break;
      case "PPageLogin":
        hideScrollbar = true;
        preventNavigation = true;
        break;
      case "PPhotoEditDialog":
        hideScrollbar = window.innerWidth < 960;
        disableScrolling = true;
        preventNavigation = true;
        break;
      case "PPhotoUploadDialog":
        hideScrollbar = window.innerWidth < 1280;
        disableScrolling = true;
        preventNavigation = true;
        break;
      case "PLightbox":
        hideScrollbar = true;
        disableScrolling = true;
        disableNavigationGestures = true;
        preventNavigation = true;
        break;
    }

    this.preventNavigation = preventNavigation;

    const htmlEl = getHtmlElement();

    if (!htmlEl) {
      if (debug) {
        console.log(`html: failed to get element (#${this.uid.toString()})`, c);
        console.groupEnd();
      }
      return false;
    }

    const bodyEl = getBodyElement();

    if (!bodyEl) {
      if (debug) {
        console.log(`body: failed to get element (#${this.uid.toString()})`, c);
        console.groupEnd();
      }
      return false;
    }

    if (hideScrollbar) {
      if (!bodyEl.classList.contains("hide-scrollbar")) {
        bodyEl.classList.add("hide-scrollbar");
        setHtmlStyle("scrollbar-width", "none");
        setHtmlStyle("overflow-y", "hidden");
        if (debug) {
          console.log(`html: added style="scrollbar-width: none; overflow-y: hidden;"`);
        }
      }
    } else if (bodyEl.classList.contains("hide-scrollbar")) {
      bodyEl.classList.remove("hide-scrollbar");
      setHtmlStyle("scrollbar-width");
      setHtmlStyle("overflow-y");
      if (debug) {
        console.log(`html: removed style="scrollbar-width: none; overflow-y: hidden;"`);
      }
    }

    if (disableScrolling) {
      if (!bodyEl.classList.contains("disable-scrolling")) {
        bodyEl.classList.add("disable-scrolling");
        if (debug) {
          console.log(`body: added class="disable-scrolling"`);
        }
      }
    } else if (bodyEl.classList.contains("disable-scrolling")) {
      bodyEl.classList.remove("disable-scrolling");
      if (debug) {
        console.log(`body: removed class="disable-scrolling"`);
      }
    }

    if (disableNavigationGestures) {
      if (!bodyEl.classList.contains("disable-navigation-gestures")) {
        bodyEl.classList.add("disable-navigation-gestures");
        window.addEventListener(TouchStartEvent, preventNavigationTouchEvent, { passive: false });
        window.addEventListener(TouchMoveEvent, preventNavigationTouchEvent, { passive: false });
        if (debug) {
          console.log(`view: disabled touch navigation gestures`);
        }
      }
    } else if (bodyEl.classList.contains("disable-navigation-gestures")) {
      bodyEl.classList.remove("disable-navigation-gestures");
      window.removeEventListener(TouchStartEvent, preventNavigationTouchEvent, false);
      window.removeEventListener(TouchMoveEvent, preventNavigationTouchEvent, false);
      if (debug) {
        console.log(`view: re-enabled touch navigation gestures`);
      }
    }

    if (debug) {
      console.groupEnd();
    }
    return true;
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
    const c = this.current();

    if (c && c.$data) {
      return c.$data;
    } else {
      return {};
    }
  }

  // Returns true if the specified view component is currently inactive, e.g. hidden in the background.
  isHidden(c) {
    return !this.hasFocus(c);
  }

  // Returns true if the specified view component is currently active, e.g. visible in the foreground.
  hasFocus(c) {
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
