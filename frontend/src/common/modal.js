/*

Copyright (c) 2018 - 2025 PhotoPrism UG. All rights reserved.

    This program is free software: you can redistribute it and/or modify
    it under Version 3 of the GNU Affero General Public License (the "AGPL"):
    <https://docs.photoprism.app/license/agpl>

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    The AGPL is supplemented by our Trademark and Brand Guidelines,
    which describe how our Brand Assets may be used:
    <https://www.photoprism.app/trademark>

Feel free to send an email to hello@photoprism.app if you have questions,
want to support our work, or just want to say hello.

Additional information can be found in our Developer Guide:
<https://docs.photoprism.app/developer-guide/>

*/

let active = 0;
let scrollbarHidden = document.body.classList.contains("hide-scrollbar");

const Modal = {
  html: function () {
    return document.getElementsByTagName("html")[0];
  },
  body: function () {
    return document.body;
  },
  preventDefault(ev) {
    if (ev && typeof ev.preventDefault === "function") {
      ev.preventDefault();
    }
  },
  update: function (preserveOverflow) {
    const htmlEl = this.html();
    const bodyEl = this.body();

    if (!htmlEl || !bodyEl) {
      return;
    }

    if (this.active()) {
      if (!bodyEl.classList.contains("disable-gestures")) {
        bodyEl.classList.add("disable-gestures");
        document.addEventListener("touchmove", this.preventDefault, false);
      }
    } else if (bodyEl.classList.contains("disable-gestures")) {
      bodyEl.classList.remove("disable-gestures");
      document.removeEventListener("touchmove", this.preventDefault, false);
    }

    if (this.scrollbarHidden()) {
      if (!preserveOverflow) {
        htmlEl.setAttribute("class", "overflow-y-hidden");
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
  },
  leave: function () {
    if (active > 0) {
      active--;
    }

    this.update();
  },
  enter: function (preserveOverflow) {
    active++;

    this.update(preserveOverflow);
  },
  active: function () {
    return active > 0;
  },
  scrollbarHidden: function () {
    return this.active() || scrollbarHidden;
  },
};

Modal.update();

export default Modal;
