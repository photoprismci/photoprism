<template>
  <v-dialog
    ref="dialog"
    :model-value="visible"
    :scrollable="false"
    fullscreen
    scrim
    tiled
    class="p-dialog p-lightbox v-dialog--lightbox"
    @after-enter="onEnter"
    @after-leave="onLeave"
  >
    <div class="p-lightbox__underlay"></div>
    <div
      ref="container"
      class="p-lightbox__container"
      @click.capture="onContainerClick"
      @pointerdown.capture="onContainerPointerDown"
    >
      <div
        ref="content"
        tabindex="1"
        class="p-lightbox__content"
        :class="{
          'sidebar-visible': sidebarVisible,
          'slideshow-active': slideshow.active,
          'is-fullscreen': isFullscreen,
          'is-favorite': model.Favorite,
          'is-playable': model.Playable,
          'is-muted': muted,
          'is-selected': $clipboard.has(model),
        }"
        @keydown.space="onKeyDown"
        @keydown.esc="onKeyDown"
      ></div>
      <div v-if="sidebarVisible" ref="sidebar" class="p-lightbox__sidebar">
        <!-- TODO: Create a reusable sidebar component that allows users to view/edit metadata. -->
      </div>
    </div>
  </v-dialog>
</template>

<script>
import PhotoSwipe from "photoswipe";
import Lightbox from "photoswipe/lightbox";
import Captions from "common/captions";
import Util from "common/util";
import $api from "common/api";
import Thumb from "model/thumb";
import { Photo } from "model/photo";
import * as media from "common/media";

export default {
  name: "PLightbox",
  data() {
    const debug = this.$config.get("debug");
    const trace = this.$config.get("trace");
    return {
      debug,
      trace,
      visible: false,
      busy: false,
      sidebarVisible: false,
      lightbox: null, // Current PhotoSwipe lightbox instance.
      captionPlugin: null, // Current PhotoSwipe caption plugin instance.
      muted: window.sessionStorage.getItem("lightbox.muted") === "true",
      hasTouch: false,
      shortVideoDuration: 5, // Duration in seconds for videos that are short enough to automatically loop.
      playControlHideDelay: 1000, // Hide the lightbox controls after this time in ms when a video starts playing.
      defaultControlHideDelay: 5000, // Automatically hide lightbox controls this time in ms, TODO: add custom settings.
      idleTimer: false,
      controlsShown: -1, // -1 or a positive timestamp indicates that the controls are shown (0 means hidden).
      canEdit: this.$config.allow("photos", "update") && this.$config.feature("edit"),
      canLike: this.$config.allow("photos", "manage") && this.$config.feature("favorites"),
      canDownload: this.$config.allow("photos", "download") && this.$config.feature("download"),
      canFullscreen: !this.$isMobile,
      isFullscreen: !window.screenTop && !window.screenY,
      mobileBreakpoint: 600, // Minimum viewport width for large screens.
      featExperimental: this.$config.featExperimental(), // Enables features that may be incomplete or unstable.
      featDevelop: this.$config.featDevelop(), // Enables new features that are still under development.
      selection: this.$clipboard.selection,
      config: this.$config.values,
      models: [], // Slide models.
      model: new Thumb(), // Current slide.
      index: 0, // Current slide index in models.
      subscriptions: [], // Event subscriptions.
      afterLeave: null, // Called after the dialog has closed.
      afterEnter: null, // Called after the dialog has opened.
      // Slideshow properties.
      slideshow: {
        active: false,
        interval: false,
        wait: 5000,
        waitAfterVideo: 2500,
        next: -1,
      },
    };
  },
  created() {
    // this.subscriptions["lightbox.change"] = this.$event.subscribe("lightbox.change", this.onChange);
    this.subscriptions["lightbox.open"] = this.$event.subscribe("lightbox.open", this.onOpen);
    this.subscriptions["lightbox.pause"] = this.$event.subscribe("lightbox.pause", this.onPause);
    this.subscriptions["lightbox.close"] = this.$event.subscribe("lightbox.close", this.onClose);
  },
  beforeUnmount() {
    this.onPause();
    this.destroyLightbox();

    for (let i = 0; i < this.subscriptions.length; i++) {
      this.$event.unsubscribe(this.subscriptions[i]);
    }
  },
  methods: {
    isBusy(action) {
      if (this.busy) {
        console.log(`lightbox: still busy, cannot ${action ? action : "do this"}`);
        return true;
      }

      return false;
    },
    onEnter() {
      if (this.afterEnter) {
        this.afterEnter();
        this.afterEnter = null;
      }

      this.afterLeave = null;
    },
    onLeave() {
      if (this.afterLeave) {
        this.afterLeave();
        this.afterLeave = null;
      }

      this.afterEnter = null;
    },
    // Returns the PhotoSwipe content element.
    getContentElement() {
      if (!this.$refs.content) {
        console.log("lightbox: content element is not visible");
        return null;
      }

      return this.$refs.content;
    },
    // Returns the metadata sidebar element.
    getSidebarElement() {
      if (!this.$refs.sidebar) {
        console.log("lightbox: sidebar element is not visible");
        return null;
      }

      return this.$refs.sidebar;
    },
    // Returns the PhotoSwipe config options, see https://photoswipe.com/options/.
    getOptions() {
      return {
        appendToEl: this.getContentElement(),
        pswpModule: PhotoSwipe,
        dataSource: this.models,
        index: this.index,
        mouseMovePan: true,
        arrowPrev: true,
        arrowNext: true,
        loop: true,
        zoom: true,
        close: true,
        counter: false,
        trapFocus: false,
        returnFocus: false,
        allowPanToNext: false,
        initialZoomLevel: "fit",
        secondaryZoomLevel: "fill",
        wheelToZoom: true,
        maxZoomLevel: 6,
        bgOpacity: 1,
        preload: [1, 1],
        showHideAnimationType: "none",
        mainClass: "p-lightbox__pswp",
        tapAction: (point, ev) => this.onContentTap(ev),
        imageClickAction: (point, ev) => this.onContentClick(ev),
        bgClickAction: (point, ev) => this.onBgClick(ev),
        paddingFn: (viewport, data) => this.getPadding(viewport, data),
        getViewportSizeFn: () => this.getViewport(),
        closeTitle: this.$gettext("Close"),
        zoomTitle: this.$gettext("Zoom in/out"),
        arrowPrevTitle: this.$gettext("Previous"),
        arrowNextTitle: this.$gettext("Next"),
        errorMsg: this.$gettext("Error"),
      };
    },
    onOpen(ev, options) {
      if (!options) {
        return;
      }

      if (options.view) {
        this.showView(options.view, options.index);
      } else {
        this.showThumbs(options.models, options.index);
      }
    },
    // Displays the thumbnail images and/or videos that belong to the specified models in the lightbox.
    showThumbs(models, index = 0) {
      // Check if at least one model was passed, as otherwise no content can be displayed.
      if (!Array.isArray(models) || models.length === 0 || index >= models.length) {
        console.log("model list passed to lightbox is empty:", models);
        return Promise.reject();
      }

      this.afterEnter = () => {
        this.renderLightbox(models, index);
      };

      this.onShow();

      return Promise.resolve();
    },
    // Loads the pictures that belong to a component and displays them in the lightbox.
    showView(view, index) {
      if (this.isBusy("show context")) {
        return Promise.reject();
      }

      if (view.loading || !view.listen || view.lightbox.loading || !view.results[index]) {
        return Promise.reject();
      }

      const selected = view.results[index];

      if (!view.lightbox.dirty && view.lightbox.results && view.lightbox.results.length > index) {
        // Reuse existing lightbox result if possible.
        let i = -1;

        if (view.lightbox.results[index] && view.lightbox.results[index].UID === selected.UID) {
          i = index;
        } else {
          i = view.lightbox.results.findIndex((p) => p.UID === selected.UID);
        }

        if (
          i > -1 &&
          (((view.lightbox.complete || view.complete) && view.lightbox.results.length >= view.results.length) ||
            i + view.lightbox.batchSize <= view.lightbox.results.length)
        ) {
          return this.showThumbs(view.lightbox.results, i);
        }
      }

      // Fetch photos from server API.
      view.lightbox.loading = true;

      const params = view.searchParams();
      params.count = params.offset + view.lightbox.batchSize;
      params.offset = 0;

      // Fetch lightbox results from API.
      return $api
        .get("photos/view", { params })
        .then((response) => {
          const count = response && response.data ? response.data.length : 0;
          if (count === 0) {
            view.$notify.warn(view.$gettext("No pictures found"));
            view.lightbox.dirty = true;
            view.lightbox.complete = false;
            return;
          }

          // Process response.
          if (response.headers && response.headers["x-count"]) {
            const c = parseInt(response.headers["x-count"]);
            const l = parseInt(response.headers["x-limit"]);
            view.lightbox.complete = c < l;
          } else {
            view.lightbox.complete = view.complete;
          }

          let i;

          if (response.data[index] && response.data[index].UID === selected.UID) {
            i = index;
          } else {
            i = response.data.findIndex((p) => p.UID === selected.UID);
          }

          view.lightbox.results = Thumb.wrap(response.data);

          // Show pictures.
          this.showThumbs(view.lightbox.results, i);
          view.lightbox.dirty = false;
        })
        .catch(() => {
          view.lightbox.dirty = true;
          view.lightbox.complete = false;
        })
        .finally(() => {
          // Unblock.
          view.lightbox.loading = false;
        });
    },
    getItemData(el, i) {
      // Get the current slide model data.
      const model = this.models[i];

      // Get the screen (window) resolution in real pixels
      const pixels = this.getWindowPixels();

      // Get the right thumbnail size based on the screen resolution in pixels.
      const thumbSize = Util.thumbSize(pixels.width, pixels.height);

      // Get thumbnail image URL, width, and height.
      const img = {
        src: model.Thumbs[thumbSize].src,
        width: model.Thumbs[thumbSize].w,
        height: model.Thumbs[thumbSize].h,
        alt: model?.Title,
      };

      // Check if content is playable and return the data needed to render it in "contentLoad".
      if (model?.Playable && model?.Hash) {
        /*
          TODO: The server should (additionally) provide a video/animation still from time index 0 that can be used as
                poster (the current thumbnail is taken later for longer videos, since the first frame is often black).
         */

        // Check the duration so that short videos can be looped, unless a slideshow is playing.
        const isShort = model?.Duration
          ? model.Duration > 0 && model.Duration <= this.shortVideoDuration * 1000000000
          : false;

        // Set the slide data needed to render and play the video.
        return {
          type: "html", // Render custom HTML.
          html: `<div class="pswp__error-msg">Loading video...</div>`, // Replaced with the <video> element.
          model: model, // Content model.
          format: Util.videoFormat(model?.Codec, model?.Mime), // Content format.
          loop: isShort || model?.Type === media.Animated || model?.Type === media.Live, // If possible, loop these types.
          msrc: img.src, // Image URL.
        };
      }

      // Return the image data so that PhotoSwipe can render it in the lightbox,
      // see https://photoswipe.com/data-sources/#dynamically-generated-data.
      return img;
    },
    onContentLoad(ev) {
      const { content } = ev;
      if (content.data?.type === "html") {
        // Prevent default loading behavior.
        ev.preventDefault();

        try {
          // Create video element.
          content.element = this.createVideoElement(content.data, false, false, false);
          content.state = "loading";
          content.onLoaded();
        } catch (err) {
          console.warn("failed to load video", err);
        }
      }
    },
    // Creates an HTMLMediaElement for playing videos, animations, and live photos.
    createVideoElement(data, autoplay = false, loop = false, mute = false) {
      const model = data.model;
      const format = data.format;
      const posterSrc = data.msrc;

      // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement.
      const video = document.createElement("video");

      // Check if a slideshow is running.
      const slideshow = this.slideshow.active;

      let preload = "none";

      if (autoplay) {
        preload = "auto";
      } else if (slideshow || loop) {
        preload = "metadata";
      }

      let controls = true;

      if (loop || slideshow) {
        controls = false;
      }

      // Set HTMLMediaElement properties.
      video.className = "pswp__video";
      video.poster = posterSrc;
      video.autoplay = autoplay;
      video.loop = loop && !slideshow;
      video.muted = mute || this.muted;
      video.preload = preload;
      video.playsInline = true;
      video.controls = controls;

      // Disable the remote playback button on mobile devices to save space.
      video.disableRemotePlayback = this.$isMobile;

      // Specify which controls should be visible (not supported on all browsers):
      // - https://wicg.github.io/controls-list/explainer.html
      // - https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controlsList
      if (video?.controlsList instanceof DOMTokenList) {
        // Disable the download button if downloads are not allowed.
        if (!this.canDownload) {
          video.controlsList.add("nodownload");
        }

        // Disable the remote playback and playback rate buttons on mobile devices to save space.
        if (this.$isMobile) {
          video.controlsList.add("noremoteplayback");
          video.controlsList.add("noplaybackrate");
        }
      }

      // Add an event listener to loop short videos of 5 seconds or less,
      // even if the server does not know the duration.
      video.addEventListener("loadedmetadata", () => {
        if (video.duration && video.duration <= this.shortVideoDuration) {
          data.loop = true;
          video.loop = data.loop && !this.slideshow.active;
          video.controls = false;
        } else {
          video.controls = !this.slideshow.active;
        }
      });

      // Add an event listener to automatically hide the lightbox controls
      // after a video has started playing.
      video.addEventListener("playing", () => {
        if (!video.paused && !video.ended) {
          this.hideControlsWithDelay(this.playControlHideDelay);
        }
      });

      // Add an event listener to automatically hide the lightbox controls
      // after a video has started playing.
      video.addEventListener("ended", () => {
        if (!this.slideshow.active) {
          this.showControls();
        } else {
          this.clearSlideshowInterval();
          this.onSlideshowNext();
          this.setSlideshowInterval();
        }
      });

      // Create and append video source elements, depending on file format support.
      if (
        format !== media.FormatAvc &&
        model?.Mime &&
        model.Mime !== media.ContentTypeMp4AvcMain &&
        video.canPlayType(model.Mime)
      ) {
        const nativeSource = document.createElement("source");
        nativeSource.type = model.Mime;
        nativeSource.src = Util.videoFormatUrl(model.Hash, format);
        video.appendChild(nativeSource);
      }

      const avcSource = document.createElement("source");
      avcSource.type = media.ContentTypeMp4AvcMain;
      avcSource.src = Util.videoFormatUrl(model.Hash, media.FormatAvc);
      video.appendChild(avcSource);

      // Return HTMLMediaElement.
      return video;
    },
    // Initializes and opens the PhotoSwipe lightbox with the
    // images and/or videos that belong to the specified models.
    renderLightbox(models, index = 0) {
      // Check if at least one model was passed, as otherwise no content can be displayed.
      if (!Array.isArray(models) || models.length === 0 || index >= models.length) {
        console.log("lightbox: model list is empty", models);
        return Promise.reject();
      }

      // Set the initial model list and start index.
      // TODO: In the future, additional models should be dynamically loaded when the index reaches the end of the list.
      this.models = models;
      this.index = index;

      // Get PhotoSwipe lightbox config options, see https://photoswipe.com/options/.
      const options = this.getOptions();

      if (!options.appendToEl) {
        console.log("lightbox: content element not found", options);
        return Promise.reject();
      }

      // Focus lightbox element.
      // TODO: Move to common/view.js
      this.getContentElement().focus();

      // Create PhotoSwipe instance.
      let lightbox = new Lightbox(options);
      let firstPicture = true;

      // Keep reference to PhotoSwipe instance.
      this.lightbox = lightbox;
      this.idleTimer = false;
      this.hasTouch = false;

      // Use dynamic caption plugin,
      // see https://github.com/dimsemenov/photoswipe-dynamic-caption-plugin.
      this.captionPlugin = new Captions(this.lightbox, {
        type: "below",
        captionContent: (slide) => {
          if (!slide || !this.models || slide?.index < 0) {
            return "";
          }

          const model = this.models[slide.index];

          if (model) {
            return this.formatCaption(model);
          }

          return "";
        },
      });

      // Add a close event handler to destroy the lightbox after use,
      // see https://photoswipe.com/events/#closing-events.
      this.lightbox.on("close", () => {
        this.$event.publish("lightbox.pause");
        this.$event.publish("lightbox.close");
      });

      // Add a custom pointer event handler to prevent the default
      // action when events are triggered on an HTMLMediaElement.
      this.lightbox.on("pointerUp", (ev) => this.onLightboxPointerEvent(ev));
      this.lightbox.on("pointerDown", (ev) => this.onLightboxPointerEvent(ev));
      this.lightbox.on("pointerMove", (ev) => this.onLightboxPointerEvent(ev));

      // Add PhotoSwipe lightbox controls,
      // see https://photoswipe.com/adding-ui-elements/.
      this.addLightboxControls();

      // Handle zoom level changes to load higher quality thumbnails
      // when image size changes
      this.lightbox.on("imageSizeChange", ({ content, width, height, slide }) => {
        if (slide === lightbox.pswp.currSlide) {
          this.onZoomLevelChange();
        }
      });

      // Trigger onChange() event handler when slide is changed and on initialization,
      // see https://photoswipe.com/events/#initialization-events.
      this.lightbox.on("change", () => {
        this.onChange();
      });

      this.lightbox.on("afterInit", () => {
        // Attach touch and mouse event handlers to automatically hide controls.
        document.addEventListener(
          "touchstart",
          () => {
            this.resetTimer();
            this.hasTouch = true;
          },
          { once: true }
        );
        document.addEventListener(
          "mousemove",
          () => {
            this.startTimer();
          },
          { once: true }
        );
      });

      // Processes model data for rendering slides with PhotoSwipe,
      // see https://photoswipe.com/filters/#itemdata.
      this.lightbox.addFilter("itemData", this.getItemData);

      // Renders content when a slide starts to load (can be default prevented),
      // see https://photoswipe.com/events/#slide-content-events.
      this.lightbox.on("contentLoad", this.onContentLoad);

      // Pauses videos, animations, and live photos when slide content becomes active (can be default prevented),
      // see https://photoswipe.com/events/#slide-content-events.
      this.lightbox.on("contentActivate", (ev) => {
        const { content } = ev;

        if (!content) {
          return;
        }

        const data = typeof content?.data === "object" ? content?.data : {};

        if (!data) {
          return;
        }

        let video;

        // Get <video> element, if any.
        if (content?.element && content?.element instanceof HTMLMediaElement) {
          video = content?.element;
        } else {
          video = false;
        }

        // Automatically play video on this slide if it's the first item,
        // a slideshow is active, or it's an animation or live photo.
        if (video) {
          if (data.loop || this.slideshow.active || firstPicture) {
            this.playVideo(content.element, data.loop);
          }
        }

        // Flag first picture as being displayed/activated.
        if (firstPicture) {
          firstPicture = false;
        }
      });

      // Pauses videos, animations, and live photos when content becomes active (can be default prevented),
      // see https://photoswipe.com/events/#slide-content-events.
      this.lightbox.on("contentDeactivate", (ev) => {
        const { content } = ev;

        // Stop any video currently playing on this slide.
        if (content?.element && content?.element instanceof HTMLMediaElement) {
          this.pauseVideo(content.element);
        }
      });

      // Init PhotoSwipe.
      this.lightbox.init();

      // Show first image.
      this.lightbox.loadAndOpen(index);

      // Publish event to be consumed by other components.
      this.$event.publish("lightbox.opened");

      return Promise.resolve();
    },
    // Adds PhotoSwipe lightbox controls, see https://photoswipe.com/adding-ui-elements/.
    addLightboxControls() {
      const lightbox = this.lightbox;

      // Add a sidebar toggle button only if the window is large enough.
      // TODO: Proof-of-concept only, the sidebar needs to be fully implemented before removing the featDevelop check.
      // TODO: Once this is fully implemented, remove the "this.experimental" flag check below.
      // IDEA: We can later try to add styles that display the sidebar at the bottom
      //       instead of on the side, to allow use on mobile devices.
      lightbox.on("uiRegister", () => {
        if (this.featDevelop && this.canEdit && window.innerWidth > this.mobileBreakpoint) {
          lightbox.pswp.ui.registerElement({
            name: "sidebar-button",
            className: "pswp__button--sidebar-button pswp__button--mdi", // Sets the icon style/size in lightbox.css.
            ariaLabel: this.$gettext("Show/Hide Sidebar"),
            order: 9,
            isButton: true,
            html: {
              isCustomSVG: true,
              inner:
                '<path d="M11 7V9H13V7H11M14 17V15H13V11H10V13H11V15H10V17H14M22 12C22 17.5 17.5 22 12 22C6.5 22 2 17.5 2 12C2 6.5 6.5 2 12 2C17.5 2 22 6.5 22 12M20 12C20 7.58 16.42 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12Z" id="pswp__icn-sidebar"/>',
              outlineID: "pswp__icn-sidebar", // Add this to the <path> in the inner property.
              size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
            },
            onClick: (ev) => this.onControlClick(ev, this.toggleSidebar),
          });
        }

        // Add sound mute/unmute control for videos.
        lightbox.pswp.ui.registerElement({
          name: "sound-toggle",
          className: "pswp__button--sound-toggle pswp__button--mdi", // Sets the icon style/size in lightbox.css.
          ariaLabel: this.$gettext("Mute"),
          order: 10,
          isButton: true,
          html: {
            isCustomSVG: true,
            inner: `<use class="pswp__icn-shadow pswp__icn-sound-on" xlink:href="#pswp__icn-sound-on"></use><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" id="pswp__icn-sound-on" class="pswp__icn-sound-on" /><use class="pswp__icn-shadow pswp__icn-sound-off" xlink:href="#pswp__icn-sound-off"></use><path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" id="pswp__icn-sound-off" class="pswp__icn-sound-off" />`,
            size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
          },
          onClick: (ev) => this.onControlClick(ev, this.toggleSound),
        });

        // Add slideshow play/pause toggle control.
        lightbox.pswp.ui.registerElement({
          name: "slideshow-toggle",
          className: "pswp__button--slideshow-toggle pswp__button--mdi", // Sets the icon style/size in lightbox.css.
          ariaLabel: this.$gettext("Start/Stop Slideshow"),
          order: 10,
          isButton: true,
          html: {
            isCustomSVG: true,
            inner: `<use class="pswp__icn-shadow pswp__icn-slideshow-on" xlink:href="#pswp__icn-slideshow-on"></use><path d="M14,19H18V5H14M6,19H10V5H6V19Z" id="pswp__icn-slideshow-on" class="pswp__icn-slideshow-on" /><use class="pswp__icn-shadow pswp__icn-slideshow-off" xlink:href="#pswp__icn-slideshow-off"></use><path d="M8,5.14V19.14L19,12.14L8,5.14Z" id="pswp__icn-slideshow-off" class="pswp__icn-slideshow-off" />`,
            size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
          },
          onClick: (ev) => this.onControlClick(ev, this.toggleSlideshow),
        });

        // Add fullscreen mode toggle control.
        if (this.canFullscreen) {
          lightbox.pswp.ui.registerElement({
            name: "fullscreen-toggle",
            className: "pswp__button--fullscreen-toggle pswp__button--mdi", // Sets the icon style/size in lightbox.css.
            ariaLabel: this.$gettext("Fullscreen"),
            order: 10,
            isButton: true,
            html: {
              isCustomSVG: true,
              inner: `<use class="pswp__icn-shadow pswp__icn-fullscreen-on" xlink:href="#pswp__icn-fullscreen-on"></use><path d="M14,14H19V16H16V19H14V14M5,14H10V19H8V16H5V14M8,5H10V10H5V8H8V5M19,8V10H14V5H16V8H19Z" id="pswp__icn-fullscreen-on" class="pswp__icn-fullscreen-on" /><use class="pswp__icn-shadow pswp__icn-fullscreen-off" xlink:href="#pswp__icn-fullscreen-off"></use><path d="M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z" id="pswp__icn-fullscreen-off" class="pswp__icn-fullscreen-off" />`,
              size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
            },
            onClick: (ev) => this.onControlClick(ev, this.toggleFullscreen),
          });
        }

        // Add favorite toggle control if user has permission to use it.
        if (this.canLike) {
          lightbox.pswp.ui.registerElement({
            name: "favorite-toggle",
            className: "pswp__button--favorite-toggle pswp__button--mdi hidden-shared-only", // Sets the icon style/size in lightbox.css.
            ariaLabel: this.$gettext("Like"),
            order: 10,
            isButton: true,
            html: {
              isCustomSVG: true,
              inner: `<use class="pswp__icn-shadow pswp__icn-favorite-on" xlink:href="#pswp__icn-favorite-on"></use><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" id="pswp__icn-favorite-on" class="pswp__icn-favorite-on" /><use class="pswp__icn-shadow pswp__icn-favorite-off" xlink:href="#pswp__icn-favorite-off"></use><path d="M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z" id="pswp__icn-favorite-off" class="pswp__icn-favorite-off" />`,
              size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
            },
            onClick: (ev) => this.onControlClick(ev, this.toggleLike),
          });
        }

        // Add selection toggle control.
        lightbox.pswp.ui.registerElement({
          name: "select-toggle",
          className: "pswp__button--select-toggle pswp__button--mdi", // Sets the icon style/size in lightbox.css.
          ariaLabel: this.$gettext("Select"),
          order: 10,
          isButton: true,
          html: {
            isCustomSVG: true,
            inner: `<use class="pswp__icn-shadow pswp__icn-select-on" xlink:href="#pswp__icn-select-on"></use><path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" id="pswp__icn-select-on" class="pswp__icn-select-on" /><use class="pswp__icn-shadow pswp__icn-select-off" xlink:href="#pswp__icn-select-off"></use><path d="M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" id="pswp__icn-select-off" class="pswp__icn-select-off" />`,
            size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
          },
          onClick: (ev) => this.onControlClick(ev, this.toggleSelect),
        });

        // Add edit button control if user has permission to use it.
        if (this.canEdit) {
          lightbox.pswp.ui.registerElement({
            name: "edit-button",
            className: "pswp__button--edit-button pswp__button--mdi hidden-shared-only", // Sets the icon style/size in lightbox.css.
            ariaLabel: this.$gettext("Edit"),
            order: 10,
            isButton: true,
            html: {
              isCustomSVG: true,
              inner: `<path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" id="pswp__icn-edit" />`,
              outlineID: "pswp__icn-edit", // Add this to the <path> in the inner property.
              size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
            },
            onClick: (ev) => this.onControlClick(ev, this.onEdit),
          });
        }

        // Add download button control if user has permission to use it.
        if (this.canDownload) {
          lightbox.pswp.ui.registerElement({
            name: "download-button",
            className: "pswp__button--download-button pswp__button--mdi", // Sets the icon style/size in lightbox.css.
            ariaLabel: this.$gettext("Download"),
            order: 10,
            isButton: true,
            html: {
              isCustomSVG: true,
              inner: `<path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" id="pswp__icn-download" />`,
              outlineID: "pswp__icn-download", // Add this to the <path> in the inner property.
              size: 24, // Depends on the original SVG viewBox, e.g. use 24 for viewBox="0 0 24 24".
            },
            onClick: (ev) => this.onControlClick(ev, this.onDownload),
          });
        }
      });
    },
    // Destroys the PhotoSwipe lightbox instance after use, see onClose().
    destroyLightbox() {
      if (this.lightbox) {
        this.lightbox?.destroy();
        this.lightbox = null;
      }
    },
    // Returns the picture (model) caption as sanitized HTML, if any.
    formatCaption(model) {
      if (!model) {
        return "";
      }

      let caption = "";

      if (model.Title) {
        caption += `<h4>${Util.encodeHTML(model.Title)}</h4>`;
      }

      /*
        TODO: Find a good position for the date information that works for all screen sizes and image dimensions.
              We MAY postpone this and display it along with other metadata in the new sidebar.
       */
      /* if (model.TakenAtLocal) {
         caption += `<div>${Util.formatDate(model.TakenAtLocal)}</div>`;
      } */

      if (model.Caption) {
        caption += `<p>${Util.encodeHTML(model.Caption)}</p>`;
      } else if (model.Description) {
        caption += `<p>${Util.encodeHTML(model.Description)}</p>`;
      }

      return Util.sanitizeHtml(caption);
    },
    onShow() {
      // Render the component template.
      this.visible = true;

      this.$view.enter(this);

      // Publish event to be consumed by other components.
      this.$event.publish("lightbox.opened");
    },
    // Destroys the PhotoSwipe lightbox, resets the component state, and unhides the browser scrollbar.
    onClose() {
      if (this.isBusy("close")) {
        return Promise.reject();
      }

      this.busy = true;
      this.$view.leave(this);

      // Pause slideshow and any videos that are playing.
      this.onPause();

      // Destroy PhotoSwipe lightbox.
      this.destroyLightbox();

      // Reset component state.
      this.onReset();

      // Hide lightbox and sidebar.
      this.hideViewer();
      this.busy = false;

      // Publish event to be consumed by other components.
      this.$event.publish("lightbox.closed");

      return Promise.resolve();
    },
    // Pauses the lightbox slideshow and any videos that are playing.
    onPause() {
      this.pausePlaying();
      this.pauseSlideshow();
    },
    // Resets the component state after closing the lightbox.
    onReset() {
      this.resetTimer();
      this.resetControls();
      this.resetModels();
    },
    // Resets the state of the lightbox controls.
    resetControls() {
      this.hasTouch = false;
      this.controlsShown = -1;
    },
    // Reset the lightbox models and index.
    resetModels() {
      this.model = new Thumb();
      this.models = [];
      this.index = 0;
    },
    // Hides the lightbox and restores the scrollbar state.
    hideViewer() {
      // Hide sidebar.
      this.hideSidebar();

      // Remove lightbox focus and hide lightbox.
      if (this.visible) {
        this.visible = false;
      }
    },
    // Returns the active PhotoSwipe instance, if any.
    // Be sure to check the result before using it!
    pswp() {
      return this.lightbox?.pswp;
    },
    // Called when the slide is changed and on initialization,
    // see https://photoswipe.com/events/#initialization-events.
    onChange() {
      // Get active PhotoSwipe instance.
      const pswp = this.pswp();

      if (!pswp) {
        return;
      }

      // Set current slide (model) list index.
      if (typeof pswp.currIndex === "number") {
        this.index = pswp.currIndex;
      }

      // Set current slide model.
      if (this.index >= 0 && this.models.length > 0 && this.index < this.models.length) {
        this.model = this.models[this.index];
      }

      // Pause the slideshow if the index of the next slide does not match.
      if (this.slideshow.next !== this.index) {
        this.pauseSlideshow();
      }
    },
    // Called when the user clicks on the PhotoSwipe lightbox background,
    // see https://photoswipe.com/click-and-tap-actions.
    onBgClick(ev) {
      if (!ev) {
        return;
      }

      if (this.controlsVisible()) {
        this.onClose();
      } else {
        this.showControls();
      }
    },
    // Called when the lightbox receives a pointer move, down or up event.
    onLightboxPointerEvent(ev) {
      if (!ev) {
        return;
      }

      const target = ev?.originalEvent?.target;

      // Don't trigger the built-in default action when an event occurs on a video
      // at the bottom of the screen, so that the player controls remain usable.
      if (target && target instanceof HTMLMediaElement) {
        if (window.innerHeight - ev?.originalEvent.y < 128) {
          ev.preventDefault();
          return true;
        }
      }
    },
    onControlClick(ev, action) {
      if (ev && ev.cancelable) {
        ev.stopPropagation();
        ev.preventDefault();
      }

      if (typeof action === "function") {
        if (this.isBusy(action.name)) {
          return false;
        } else if (this.controlsVisible()) {
          action();
          return true;
        } else {
          console.log(`lightbox: controls not visible, will not call ${action.name}`);
        }
      }

      return false;
    },
    onContainerClick(ev) {
      if (!ev) {
        return;
      }

      if (ev.y <= 128) {
        // Reveal controls when user clicks/touches the top of the screen.
        if (!this.controlsVisible()) {
          ev.stopPropagation();
          ev.preventDefault();
          this.resetTimer();
          this.showLightboxControls();
          this.hideControlsWithDelay(this.defaultControlHideDelay);
        }
      } else if (ev.target instanceof HTMLMediaElement) {
        // Stop event default and propagation when user clicks/touches the player controls at the bottom of the screen.
        if (window.innerHeight - ev.y > 128) {
          ev.stopPropagation();
          ev.preventDefault();
        }
      }
    },
    // Called when a pointer down (click, touch) event is captured by the lightbox container.
    onContainerPointerDown(ev) {
      if (!ev) {
        return;
      }

      // Handle the event and prevent it from propagating when it occurs on a video element
      // except at the bottom of the screen, so that the player controls remain usable.
      if (ev.target instanceof HTMLMediaElement) {
        ev.stopPropagation();

        if (window.innerHeight - ev.y > 128) {
          ev.preventDefault();
          this.resetTimer();

          if (this.slideshow.active) {
            this.pauseSlideshow();
          }

          // Toggle video playback.
          this.toggleVideo();
        } else {
          this.showControls();
        }
      }
    },
    // Called when the user clicks on an image slide in the lightbox.
    onContentClick(ev) {
      if (!ev) {
        return;
      }

      if (this.slideshow.active) {
        this.pauseSlideshow();
      }

      const pswp = this.pswp();

      if (pswp.currSlide.isZoomable()) {
        pswp.currSlide.toggleZoom();
      }
    },
    // Called when the user taps on an image slide in the lightbox.
    onContentTap(ev) {
      if (!ev) {
        return;
      }

      if (ev.target instanceof HTMLMediaElement) {
        // Do nothing.
      } else {
        ev.stopPropagation();
        ev.preventDefault();
        this.toggleControls();
      }
    },
    toggleFullscreen() {
      if (document.fullscreenElement) {
        document
          .exitFullscreen()
          .then(() => {
            this.isFullscreen = false;
            this.resize(true);
          })
          .catch((err) => console.error(err));
      } else {
        document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => {
          this.isFullscreen = true;
          this.resize(true);
        });
      }
    },
    // Toggles the favorite flag of the current picture.
    toggleLike() {
      this.model.toggleLike();
    },
    // Toggles the selection of the current picture in the global photo clipboard.
    toggleSelect() {
      this.$clipboard.toggle(this.model);
    },
    // Returns the active HTMLMediaElement element in the lightbox, if any.
    getContent() {
      const result = { content: null, data: null, video: null };
      const pswp = this.pswp();

      if (!pswp) {
        return result;
      }

      result.content = pswp?.currSlide?.content;

      if (!result.content) {
        return result;
      }

      result.data = typeof result.content.data === "object" ? result.content.data : {};

      // Get <video> element, if any.
      if (result.content.element && result.content.element instanceof HTMLMediaElement) {
        result.video = result.content.element;
      }

      return result;
    },
    // Finds and pauses an actively playing video, e.g. before closing the lightbox.
    pausePlaying() {
      // Get active video element, if any.
      const { video } = this.getContent();

      if (!video) {
        return;
      }

      // Calling pause() before a play promise has been resolved may result in an error,
      // see https://github.com/flutter/flutter/issues/136309 (we'll ignore this for now).
      if (!video.paused) {
        try {
          video.pause();
        } catch (e) {
          console.log(e);
        }
      }
    },
    // Starts playback on the specified video element, if any.
    playVideo(el, loop) {
      if (!el || typeof el.play !== "function") {
        return;
      }

      if (el.preload === "none") {
        el.preload = "auto";
      }

      el.loop = loop && !this.slideshow.active;
      el.controls = !(loop || this.slideshow.active);
      el.muted = this.muted;

      if (el.paused || el.ended) {
        try {
          // Calling pause() before a play promise has been resolved may result in an error,
          // see https://developer.chrome.com/blog/play-request-was-interrupted.
          const playPromise = el.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              if (this.trace) {
                console.log(e.message);
              }
            });
          }
        } catch (_) {
          // Ignore.
        }
      }
    },
    // Handles keyboard events.
    onKeyDown(ev) {
      if (!ev || !ev.code || !this.visible || this.sidebarVisible) {
        return;
      }

      switch (ev.code) {
        case "Space":
          ev.preventDefault();
          ev.stopPropagation();

          // Get active video element, if any.
          const { video } = this.getContent();

          if (video) {
            this.toggleVideo();
          } else {
            this.toggleControls();
          }
          break;
        case "Escape":
          ev.preventDefault();
          ev.stopPropagation();
          this.onClose();
          break;
      }
    },
    // Toggles video playback on the current video element, if any.
    toggleVideo() {
      // Get active video element, if any.
      const { data, video } = this.getContent();

      if (!video) {
        return;
      }

      // Play video if it is currently paused and pause it otherwise.
      if (video.paused || video.ended) {
        this.playVideo(video, data.loop);
      } else {
        this.pauseVideo(video);
      }
    },
    // Shows the controls on the current video element, if any.
    showVideoControls() {
      // Get active video element, if any.
      const { video, data } = this.getContent();

      if (!video) {
        return;
      }

      video.controls = !data?.loop && !this.slideshow.active;
    },
    // Hides the controls on the current video element, if any.
    hideVideoControls() {
      // Get active video element, if any.
      const { video } = this.getContent();

      if (!video) {
        return;
      }

      video.controls = false;
    },
    // Stops playback on the specified video element, if any.
    pauseVideo(el) {
      if (el && typeof el.pause === "function" && !el.paused) {
        try {
          el.pause();
          this.showControls();
        } catch (e) {
          console.log(e);
        }
      }
    },
    // Mutes/unmutes the sound for videos.
    toggleSound() {
      this.muted = !this.muted;

      window.sessionStorage.setItem("lightbox.muted", this.muted.toString());

      const { video } = this.getContent();

      if (!video) {
        return;
      }

      video.muted = this.muted;
    },
    // Starts/stops a slideshow so that the next slide opens automatically at regular intervals.
    toggleSlideshow() {
      if (this.slideshow.active || this.slideshow.interval) {
        this.pauseSlideshow();
      } else {
        this.playSlideshow();
      }
    },
    // Starts a slideshow, if not already active.
    playSlideshow() {
      // Return if already playing.
      if (this.slideshow.active) {
        return;
      }

      // Flag slideshow as active.
      this.slideshow.active = true;

      // Get PhotoSwipe instance.
      const pswp = this.pswp();

      // Play video, if any, but without looping.
      this.playVideo(pswp.currSlide?.content?.element, false);

      // Show next slide at regular intervals.
      this.setSlideshowInterval();
    },
    setSlideshowInterval() {
      this.clearSlideshowInterval();

      if (!this.slideshow.active) {
        return;
      }

      this.slideshow.interval = setInterval(() => {
        this.onSlideshowNext();
      }, this.slideshow.wait);
    },
    clearSlideshowInterval() {
      if (this.slideshow.interval) {
        clearInterval(this.slideshow.interval);
        this.slideshow.interval = false;
      }
    },
    onSlideshowNext() {
      // Get PhotoSwipe instance.
      const pswp = this.pswp();

      if (!pswp || typeof pswp.next !== "function" || !pswp.currSlide?.content) {
        this.pauseSlideshow();
        return;
      }

      const { video } = this.getContent();

      if (video && !video.paused) {
        // Do nothing if a video is still playing.
      } else if (this.models.length > this.index + 1) {
        // Show the next slide.
        this.slideshow.next = this.index + 1;
        pswp.next();
      } else {
        // Pause slideshow if this is the end.
        this.pauseSlideshow();
      }
    },
    // Pauses the slideshow, if currently active.
    pauseSlideshow() {
      if (this.slideshow.active) {
        this.slideshow.active = false;
      }

      this.clearSlideshowInterval();

      this.slideshow.next = -1;

      this.showControls();
    },
    // Downloads the original files of the current picture.
    onDownload() {
      this.pauseSlideshow();

      /*
        TODO: Once all the lightbox's core functionality has been restored, add a file size/type
              selection dialog so the user can choose which format and quality to download.
       */

      if (!this.model || !this.model.DownloadUrl) {
        console.warn("photo lightbox: no download url");
        return;
      }

      this.$notify.success(this.$gettext("Downloading…"));

      new Photo().find(this.model.UID).then((p) => p.downloadAll());
    },
    onEdit() {
      this.onPause();

      let index = 0;

      // remove duplicates
      let filtered = this.models?.filter(function (p, i, s) {
        return !(i > 0 && p.UID === s[i - 1].UID);
      });

      let selection = filtered.map((p, i) => {
        if (this.model.UID === p.UID) {
          index = i;
        }

        return p.UID;
      });

      let album = null;

      // Close lightbox and open edit dialog when closed.
      this.onClose();
      this.afterLeave = () => {
        this.$event.publish("dialog.edit", { selection, album, index });
      };
    },
    resize(force) {
      this.$nextTick(() => {
        if (this.visible && this.getContentElement()) {
          const pswp = this.pswp();
          if (pswp && pswp?.updateSize) {
            pswp.updateSize(force);
          }
        }
      });
    },
    toggleSidebar() {
      if (!this.visible) {
        return;
      }

      if (this.sidebarVisible) {
        this.hideSidebar();
      } else {
        this.showSidebar();
      }
    },
    // Shows the lightbox sidebar, if hidden.
    showSidebar() {
      if (!this.visible || this.sidebarVisible) {
        return;
      }

      this.sidebarVisible = true;

      // Set focus to sidebar and resize the content element.
      this.$nextTick(() => {
        this.getSidebarElement().focus();
        this.resize(true);
      });
    },
    // Hides the lightbox sidebar, if visible.
    hideSidebar() {
      if (!this.visible || !this.sidebarVisible) {
        return;
      }

      this.sidebarVisible = false;

      // Return focus and resize the content element.
      this.$nextTick(() => {
        this.getContentElement().focus();
        this.resize(true);
      });
    },
    toggleControls() {
      if (!this.visible) {
        return;
      }

      if (this.pswp() && this.pswp().element) {
        const el = this.pswp().element;
        if (el.classList.contains("pswp--ui-visible")) {
          this.hideControls();
        } else {
          this.showControls();
        }
      }
    },
    showControls() {
      if (!this.visible) {
        return;
      }

      this.showLightboxControls();
      this.showVideoControls();
      this.startTimer();
    },
    showLightboxControls() {
      this.controlsShown = Date.now();
      this.showPswpControls();
    },
    showPswpControls() {
      const pswp = this.pswp();
      if (pswp && pswp.element?.classList?.add) {
        pswp.element.classList.add("pswp--ui-visible");
      }
    },
    hideControls() {
      if (!this.visible) {
        return;
      }

      this.hideLightboxControls();
      this.hideVideoControls();
    },
    hideLightboxControls() {
      this.controlsShown = 0;
      this.hidePswpControls();
    },
    hidePswpControls() {
      const pswp = this.pswp();
      if (pswp && pswp.element?.classList?.remove) {
        pswp.element.classList.remove("pswp--ui-visible");
      }
    },
    hideControlsWithDelay(delay) {
      if (!delay || delay < 1) {
        return;
      }

      this.resetTimer();
      this.idleTimer = window.setTimeout(() => {
        this.hideControls();
      }, delay);
    },
    controlsVisible() {
      return this.controlsShown !== 0;
    },
    startTimer() {
      if (this.hasTouch || this.$isMobile) {
        return;
      }

      this.hideControlsWithDelay(this.defaultControlHideDelay);

      document.addEventListener(
        "mousemove",
        (ev) => {
          this.showControls(ev);
        },
        { once: true }
      );
    },
    // Resets the timer for hiding the lightbox controls.
    resetTimer() {
      if (this.idleTimer) {
        window.clearTimeout(this.idleTimer);
        this.idleTimer = false;
      }
    },
    getWindowPixels() {
      return {
        width: window.innerWidth * window.devicePixelRatio,
        height: window.innerHeight * window.devicePixelRatio,
      };
    },
    getViewport() {
      const el = this.getContentElement();

      if (el) {
        return {
          x: el.clientWidth,
          y: el.clientHeight,
        };
      } else {
        return {
          x: window.innerWidth,
          y: window.innerHeight,
        };
      }
    },
    getPadding(viewport, data) {
      let top = 0,
        bottom = 0,
        left = 0,
        right = 0;

      // No lightbox padding if content width or height is not specified.
      if (!viewport || !data?.width || !data?.height) {
        return { top, bottom, left, right };
      }

      // Determine lightbox padding based on content and viewport size.
      if (viewport.x > this.mobileBreakpoint) {
        // Large screens.
        if (data.width % viewport.x !== 0 && viewport.x > viewport.y) {
          left = 48;
          right = 48;
        }

        if (data.height % viewport.y === 0) {
          top = 48;
          bottom = 48;
          left = 48;
          right = 48;
        } else if (data.height > data.width) {
          top = 48;
          bottom = 48;
        } else {
          top = 72;
          bottom = 64;
        }
      } else {
        // Small screens.
        top = 56;
        bottom = 8;
      }

      return { top, bottom, left, right };
    },
    // Called when the zoom level changes and higher quality thumbnails may be required.
    onZoomLevelChange() {
      const pswp = this.pswp();

      if (!pswp || !pswp.currSlide) {
        return;
      }

      // Get current slide and zoom level.
      const zoomLevel = pswp.currSlide.currZoomLevel;
      const currSlide = pswp.currSlide;
      const currIndex = pswp.currIndex;
      const model = this.models[currIndex];

      // Don't continue if current model is not set.
      if (!model || !model.Thumbs) {
        return;
      }

      // Don't continue if slide is not zoomed.
      if (zoomLevel < 1) {
        return;
      }

      // Calculate thumbnail width and height based on slide size multiplied by zoom level and pixel ratio.
      const currentWidth = Math.round(currSlide.width * zoomLevel * window.devicePixelRatio);
      const currentHeight = Math.round(currSlide.height * zoomLevel * window.devicePixelRatio);

      // Find the right thumbnail size based on the slide size and zoom level in pixels.
      const thumbSize = Util.thumbSize(currentWidth, currentHeight);

      // Don't continue of no matching size was found.
      if (!thumbSize) {
        return;
      }

      // New thumbnail image URL, width, and height.
      const img = {
        src: model.Thumbs[thumbSize].src,
        width: model.Thumbs[thumbSize].w,
        height: model.Thumbs[thumbSize].h,
      };

      // Get current thumbnail image URL.
      const currentSrc = currSlide.data?.src;

      // Don't update thumbnail if the URL stays the same.
      if (currentSrc === img.src) {
        return;
      }

      // Create HTMLImageElement to load thumbnail image in the matching size.
      const el = new Image();
      el.src = img.src;

      // Swap thumbnails when the new image has loaded.
      el.onload = () => {
        // Abort if image URL is empty or the current slide is undefined.
        if (!pswp.currSlide || !el?.src) {
          return;
        }

        // Update the slide's HTMLImageElement to use the new thumbnail image.
        pswp.currSlide.content.element.src = el.src;
        pswp.currSlide.content.element.width = img.width;
        pswp.currSlide.content.element.height = img.height;

        // Update PhotoSwipe's slide data.
        pswp.currSlide.data.src = img.src;
        pswp.currSlide.data.width = img.width;
        pswp.currSlide.data.height = img.height;
      };
    },
  },
};
</script>
