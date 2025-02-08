<template>
  <div id="photoprism" :class="['theme-' + themeName]">
    <p-loading-bar height="4"></p-loading-bar>

    <p-notify></p-notify>

    <v-app :class="appClass">
      <p-navigation></p-navigation>

      <v-main>
        <router-view></router-view>
      </v-main>
    </v-app>

    <p-lightbox ref="lightbox"></p-lightbox>
  </div>
</template>

<script>
import Event from "pubsub-js";
import PLoadingBar from "component/loading-bar.vue";
import PNotify from "component/notify.vue";
import PNavigation from "component/navigation.vue";
import PLightbox from "component/lightbox.vue";

export default {
  name: "App",
  components: {
    PLoadingBar,
    PNotify,
    PNavigation,
    PLightbox,
  },
  data() {
    return {
      themeName: this.$config.themeName,
      subscriptions: [],
      touchStart: 0,
    };
  },
  computed: {
    appClass: function () {
      return [
        this.$route.meta.background,
        this.$vuetify.display.smAndDown ? "small-screen" : "large-screen",
        this.$route.meta.hideNav ? "hide-nav" : "show-nav",
      ];
    },
  },
  created() {
    // TODO: Find a better solution that plays nice with modal dialogs.
    // document.addEventListener("touchstart", this.onTouchStart.bind(this), { passive: true });
    // document.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: true });

    this.subscriptions["view.refresh"] = Event.subscribe("view.refresh", (ev, data) => this.onRefresh(data));
    this.$config.setVuetify(this.$vuetify);
  },
  mounted() {
    this.$view.enter(this);
  },
  unmounted() {
    for (let i = 0; i < this.subscriptions.length; i++) {
      Event.unsubscribe(this.subscriptions[i]);
    }

    // TODO: Find a better solution that plays nice with modal dialogs.
    // document.removeEventListener("touchstart", this.onTouchStart.bind(this), false);
    // document.removeEventListener("touchmove", this.onTouchMove.bind(this), false);
  },
  methods: {
    onRefresh(config) {
      this.themeName = config.themeName;
    },
    onTouchStart(ev) {
      this.touchStart = ev.touches[0].pageY;
    },
    onTouchMove(ev) {
      if (!this.touchStart /* || this.$view.isDialog() */) {
        return;
      }

      // Don't fire event when a dialog or the photo/video lightbox is open.
      if (document.querySelector(".v-overlay--active, .pswp--open") !== null) {
        return;
      }

      const y = ev.touches[0].pageY;
      const h = window.document.documentElement.scrollHeight - window.document.documentElement.clientHeight;

      if (window.scrollY >= h - 400 && y < this.touchStart) {
        Event.publish("touchmove.bottom");
        this.touchStart = 0;
      } else if (window.scrollY === 0 && y > this.touchStart + 400) {
        Event.publish("touchmove.top");
        this.touchStart = 0;
      }
    },
  },
};
</script>
