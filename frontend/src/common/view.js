import { toRaw } from "vue";

const hideScrollbarDefault = document.body.classList.contains("hide-scrollbar");

const TouchStartEvent = "touchstart";
const TouchMoveEvent = "touchmove";

// getHtmlElement returns the <html> element.
export function getHtmlElement() {
  return document.getElementsByTagName("html")[0];
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
    if (ev.type === TouchStartEvent && (isMediaElement(ev.target) || ev.touches[0].clientX <= 16)) {
      if (window.innerHeight - ev.touches[0].clientY > 128 || ev.touches[0].clientX <= 16) {
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
// and applies the UI state from that context.
export class View {
  constructor() {
    this.scopes = [];
    this.preventNavigation = false;
    this.apply();
  }

  enter(c) {
    if (!c) {
      return;
    }

    this.scopes.push(c);

    this.apply(c);

    return this.scopes.length;
  }

  apply(c) {
    const htmlEl = getHtmlElement();
    const bodyEl = getBodyElement();

    if (!htmlEl || !bodyEl) {
      return;
    }

    if (!c && this.scopes.length) {
      c = this.scopes[this.scopes.length - 1];
    }

    const uid = c?.$?.uid;
    const name = c?.$options?.name ? c.$options.name : "";

    let hideOverflow = false;
    let preventNavigation = uid > 0 && !name.startsWith("PPage");
    let hideScrollbar = this.scopes.length > 1 || hideScrollbarDefault;

    switch (name) {
      case "PPageLogin":
        hideOverflow = window.$isMobile;
        break;
      case "PViewer":
      case "PPhotoEditDialog":
      case "PPhotoUploadDialog":
        preventNavigation = true;
        hideOverflow = true;
        break;
    }

    this.preventNavigation = preventNavigation;

    if (name && uid && window.__CONFIG__?.develop) {
      const scope = this.scopes.map((s) => s?.$options?.name).join(" > ");

      if (Number.isInteger(uid)) {
        console.log(`view: ${scope} #${uid.toString()}`, toRaw(c.$data));
      } else {
        console.log(`view: ${scope}`, toRaw(c.$data));
      }
    }

    if (preventNavigation) {
      if (!bodyEl.classList.contains("prevent-navigation")) {
        bodyEl.classList.add("prevent-navigation");
        document.addEventListener(TouchStartEvent, preventNavigationTouchEvent, { passive: false });
        document.addEventListener(TouchMoveEvent, preventNavigationTouchEvent, { passive: false });
      }
    } else if (bodyEl.classList.contains("prevent-navigation")) {
      bodyEl.classList.remove("prevent-navigation");
      document.removeEventListener(TouchStartEvent, preventNavigationTouchEvent, false);
      document.removeEventListener(TouchMoveEvent, preventNavigationTouchEvent, false);
    }

    if (hideScrollbar) {
      if (hideOverflow) {
        htmlEl.setAttribute("class", "overflow-y-hidden");
      } else {
        htmlEl.removeAttribute("class");
      }

      if (!bodyEl.classList.contains("hide-scrollbar")) {
        bodyEl.classList.add("hide-scrollbar");
      }
    } else {
      htmlEl.removeAttribute("class");
      if (bodyEl.classList.contains("hide-scrollbar")) {
        bodyEl.classList.remove("hide-scrollbar");
      }
    }
  }

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

    this.apply();

    return this.scopes.length;
  }

  isHidden(c) {
    return !this.isVisible(c);
  }

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

  isRoot() {
    return !this.scopes.length;
  }

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
