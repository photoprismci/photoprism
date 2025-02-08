<template>
  <v-dialog :model-value="show" max-width="580" class="p-dialog p-settings-webdav">
    <v-card>
      <v-card-title class="d-flex justify-start align-center ga-3">
        <v-icon size="28" color="primary">mdi-swap-horizontal</v-icon>
        <h6 class="text-h6">{{ $gettext(`Connect via WebDAV`) }}</h6>
      </v-card-title>

      <v-card-text class="text-body-2">
        {{ $gettext(`WebDAV clients can connect to PhotoPrism using the following URL:`) }}
      </v-card-text>

      <v-card-text class="text-body-2">
        <v-text-field
          append-inner-icon="mdi-content-copy"
          autocorrect="off"
          autocapitalize="none"
          autocomplete="off"
          hide-details
          readonly
          single-line
          :model-value="webdavUrl()"
          class="input-url"
          @click:append-inner="$util.copyText(webdavUrl())"
          @click.stop="$util.copyText(webdavUrl())"
        ></v-text-field>
      </v-card-text>

      <v-card-text class="text-body-2 clickable" @click="windowsHelp($event)">
        {{ $gettext(`On Windows, enter the following resource in the connection dialog:`) }}
      </v-card-text>

      <v-card-text class="text-body-2">
        <v-text-field
          append-inner-icon="mdi-content-copy"
          autocorrect="off"
          autocapitalize="none"
          autocomplete="off"
          hide-details
          readonly
          single-line
          :model-value="windowsUrl()"
          class="input-url"
          @click:append-inner="$util.copyText(windowsUrl())"
          @click.stop="$util.copyText(windowsUrl())"
        ></v-text-field>
      </v-card-text>

      <v-card-text class="text-body-2">
        {{
          $gettext(
            `This mounts the originals folder as a network drive and allows you to open, edit, and delete files from your computer or smartphone as if they were local.`
          )
        }}
      </v-card-text>

      <v-card-text class="pt-3 text-body-2">
        <v-alert color="surface-variant" icon="mdi-information" class="pa-2" variant="outlined">
          <a
            class="text-link"
            style="color: inherit"
            href="https://docs.photoprism.app/user-guide/sync/webdav/"
            target="_blank"
          >
            {{ $gettext(`Detailed instructions can be found in our User Guide.`) }}
          </a>
        </v-alert>
      </v-card-text>

      <v-card-actions class="action-buttons">
        <v-btn variant="flat" color="button" class="action-close" @click.stop="close">
          {{ $gettext(`Close`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "PSettingsWebdav",
  props: {
    show: Boolean,
  },
  data() {
    return {
      visible: false,
      user: this.$session.getUser(),
    };
  },
  watch: {
    show(visible) {
      if (visible) {
        this.$view.enter(this);
      } else {
        this.$view.leave(this);
      }
    },
  },
  methods: {
    webdavUrl() {
      let baseUrl = `${window.location.protocol}//${encodeURIComponent(this.user.Name)}@${window.location.host}/originals/`;

      if (this.user.BasePath) {
        baseUrl = `${baseUrl}${this.user.BasePath}/`;
      }

      return baseUrl;
    },
    windowsUrl() {
      let baseUrl = "";

      if (window.location.protocol === "https") {
        baseUrl = `\\\\${window.location.host}@SSL\\originals\\`;
      } else {
        baseUrl = `\\\\${window.location.host}\\originals\\`;
      }

      if (this.user.BasePath) {
        const basePath = this.user.BasePath.replace(/\//g, "\\");
        baseUrl = `${baseUrl}${basePath}\\`;
      }

      return baseUrl;
    },
    windowsHelp(ev) {
      window.open("https://docs.photoprism.app/user-guide/sync/webdav/#connect-to-a-webdav-server", "_blank");
      ev.preventDefault();
      ev.stopPropagation();
    },
    close() {
      this.$emit("close");
    },
  },
};
</script>
