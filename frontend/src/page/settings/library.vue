<template>
  <div class="p-tab p-settings-library py-2">
    <v-form
      ref="form"
      validate-on="invalid-input"
      class="p-form-settings"
      accept-charset="UTF-8"
      @submit.prevent="onChange"
    >
      <v-card flat tile class="mt-0 px-1 bg-background">
        <v-card-title class="pb-0 text-subtitle-2">
          {{ $gettext(`Index`) }}
        </v-card-title>

        <v-card-actions>
          <v-row align="start" dense>
            <v-col cols="12" sm="4">
              <v-checkbox
                v-model="settings.features.review"
                :disabled="busy"
                class="ma-0 pa-0 input-review"
                density="compact"
                color="surface-variant"
                :label="$gettext('Quality Filter')"
                :hint="
                  $gettext(
                    'Require non-photographic and low-quality images to be reviewed before they appear in search results.'
                  )
                "
                prepend-icon="mdi-eye"
                persistent-hint
                @update:model-value="onChange"
              >
              </v-checkbox>
            </v-col>

            <v-col cols="12" sm="4">
              <v-checkbox
                v-model="settings.features.estimates"
                :disabled="busy"
                class="ma-0 pa-0 input-estimates"
                density="compact"
                color="surface-variant"
                :label="$gettext('Estimate Locations')"
                :hint="$gettext('Estimate the approximate location of pictures without GPS coordinates.')"
                prepend-icon="mdi-map-clock-outline"
                persistent-hint
                @update:model-value="onChange"
              >
              </v-checkbox>
            </v-col>

            <v-col cols="12" sm="4">
              <v-checkbox
                v-model="settings.index.convert"
                :disabled="busy || demo || (!experimental && settings.index.convert)"
                class="ma-0 pa-0 input-convert"
                density="compact"
                color="surface-variant"
                :label="$gettext('Generate Previews')"
                :hint="$gettext('Extract still images and generate thumbnails while indexing.')"
                prepend-icon="mdi-image-size-select-large"
                persistent-hint
                @update:model-value="onChange"
              >
              </v-checkbox>
            </v-col>
          </v-row>
        </v-card-actions>
      </v-card>

      <v-card flat tile class="mt-0 px-1 bg-background">
        <v-card-title class="pb-0 text-subtitle-2">
          {{ $gettext(`Stacks`) }}
        </v-card-title>

        <v-card-actions>
          <v-row align="start" dense>
            <v-col cols="12" sm="4">
              <v-checkbox
                v-model="settings.stack.meta"
                :disabled="busy"
                class="ma-0 pa-0 input-stack-meta"
                density="compact"
                color="surface-variant"
                :label="$gettext('Place & Time')"
                :hint="$gettext('Stack pictures taken at the exact same time and location based on their metadata.')"
                prepend-icon="mdi-clock-time-four-outline"
                persistent-hint
                @update:model-value="onChange"
              >
              </v-checkbox>
            </v-col>

            <v-col cols="12" sm="4">
              <v-checkbox
                v-model="settings.stack.uuid"
                :disabled="busy"
                class="ma-0 pa-0 input-stack-uuid"
                density="compact"
                color="surface-variant"
                :label="$gettext('Unique ID')"
                :hint="$gettext('Stack files sharing the same unique image or instance identifier.')"
                prepend-icon="mdi-fingerprint"
                persistent-hint
                @update:model-value="onChange"
              >
              </v-checkbox>
            </v-col>

            <v-col cols="12" sm="4">
              <v-checkbox
                v-model="settings.stack.name"
                :disabled="busy"
                class="ma-0 pa-0 input-stack-name"
                density="compact"
                color="surface-variant"
                :label="$gettext('Sequential Name')"
                :hint="
                  $gettext(
                    'Files with sequential names like \'IMG_1234 (2)\' and \'IMG_1234 (3)\' belong to the same picture.'
                  )
                "
                prepend-icon="mdi-format-list-numbered-rtl"
                persistent-hint
                @update:model-value="onChange"
              >
              </v-checkbox>
            </v-col>
          </v-row>
        </v-card-actions>
      </v-card>
    </v-form>

    <p-about-footer></p-about-footer>
  </div>
</template>

<script>
import Settings from "model/settings";
import * as options from "options/options";
import PAboutFooter from "component/about/footer.vue";

export default {
  name: "PSettingsLibrary",
  components: {
    PAboutFooter,
  },
  data() {
    const isDemo = this.$config.get("demo");

    return {
      demo: isDemo,
      readonly: this.$config.get("readonly"),
      experimental: this.$config.get("experimental"),
      config: this.$config.values,
      settings: new Settings(this.$config.getSettings()),
      options: options,
      busy: this.$config.loading(),
      subscriptions: [],
    };
  },
  created() {
    this.load();
    this.subscriptions.push(
      this.$event.subscribe("config.updated", (ev, data) => this.settings.setValues(data.config.settings))
    );
  },
  unmounted() {
    for (let i = 0; i < this.subscriptions.length; i++) {
      this.$event.unsubscribe(this.subscriptions[i]);
    }
  },
  methods: {
    load() {
      this.$config.load().then(() => {
        this.settings.setValues(this.$config.getSettings());
        this.busy = false;
      });
    },
    onChange() {
      const reload = this.settings.changed("ui", "language");

      if (reload) {
        this.busy = true;
      }

      this.settings
        .save()
        .then(() => {
          if (reload) {
            this.$notify.info(this.$gettext("Reloading…"));
            this.$notify.blockUI();
            setTimeout(() => window.location.reload(), 100);
          } else {
            this.$notify.success(this.$gettext("Changes successfully saved"));
          }
        })
        .finally(() => (this.busy = false));
    },
  },
};
</script>
