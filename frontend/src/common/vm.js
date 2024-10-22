export let vm = {
  $gettext: (msgid) => msgid,
  $ngettext: (msgid, plural, n) => {
    return n > 1 ? plural : msgid;
  },
  $pgettext: (context, msgid) => msgid,
  $npgettext: (context, msgid) => msgid,
};

export function T(msgid) {
  return vm.$gettext(msgid);
}

export function $gettext(msgid) {
  return vm.$gettext(msgid);
}

export function $ngettext(msgid, plural, n) {
  return vm.$ngettext(msgid, plural, n);
}

export function Mount(app, router) {
  // router.isReady().then(() => app.mount('#app'))
  app.mount("#app");
}
