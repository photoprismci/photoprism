<template>
  <div class="p-page p-page-errors">
    <v-toolbar
      flat
      :density="$vuetify.display.smAndDown ? 'compact' : 'default'"
      class="page-toolbar"
      color="secondary"
    >
      <v-text-field
        :model-value="filter.q"
        hide-details
        clearable
        overflow
        single-line
        rounded
        variant="solo-filled"
        :density="density"
        validate-on="invalid-input"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="none"
        :placeholder="$gettext('Search')"
        prepend-inner-icon="mdi-magnify"
        color="surface-variant"
        class="input-search background-inherit elevation-0"
        @update:modelValue="
          (v) => {
            updateFilter({ q: v });
          }
        "
        @keyup.enter="() => updateQuery()"
        @click:clear="
          () => {
            updateQuery({ q: '' });
          }
        "
      ></v-text-field>

      <v-btn icon class="action-reload" :title="$gettext('Reload')" @click.stop="onReload()">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
      <v-btn v-if="!isPublic" icon class="action-delete" :title="$gettext('Delete')" @click.stop="onDelete()">
        <v-icon>mdi-delete</v-icon>
      </v-btn>
      <v-btn
        icon
        href="https://docs.photoprism.app/getting-started/troubleshooting/"
        target="_blank"
        class="action-bug-report"
        :title="$gettext('Troubleshooting Checklists')"
      >
        <v-icon>mdi-bug</v-icon>
      </v-btn>
    </v-toolbar>
    <div v-if="loading" fluid class="pa-6">
      <v-progress-linear :indeterminate="true"></v-progress-linear>
    </div>
    <div v-else-if="errors.length > 0" fluid class="pa-0">
      <p-scroll
        :load-more="loadMore"
        :load-disabled="scrollDisabled"
        :load-distance="scrollDistance"
        :loading="loading"
      ></p-scroll>

      <v-list lines="one" bg-color="table" density="compact">
        <v-list-item
          v-for="err in errors"
          :key="err.ID"
          :prepend-icon="err.Level === 'error' ? 'mdi-alert-circle-outline' : 'mdi-alert'"
          density="compact"
          :title="err.Message"
          :subtitle="formatTime(err.Time)"
          @click="showDetails(err)"
        >
          <template #prepend>
            <v-icon v-if="err.Level === 'error'" icon="mdi-alert-circle-outline" color="error"></v-icon>
            <v-icon v-else-if="err.Level === 'warning'" icon="mdi-alert" color="warning"></v-icon>
            <v-icon v-else icon="mdi-information-outline" color="info"></v-icon>
          </template>
        </v-list-item>
      </v-list>
    </div>
    <div v-else class="pa-3">
      <v-alert color="primary" icon="mdi-check-circle-outline" class="no-results" variant="outlined">
        <div v-if="filter.q">
          {{ $gettext(`No warnings or error containing this keyword. Note that search is case-sensitive.`) }}
        </div>
        <div v-else>
          {{
            $gettext(
              `Log messages appear here whenever PhotoPrism comes across broken files, or there are other potential issues.`
            )
          }}
        </div>
      </v-alert>
    </div>
    <p-confirm-action
      :show="dialog.delete"
      icon="mdi-delete-outline"
      @close="dialog.delete = false"
      @confirm="onConfirmDelete"
    ></p-confirm-action>
    <v-dialog v-model="details.show" max-width="550" class="p-dialog">
      <v-card>
        <v-card-title class="d-flex justify-start align-center ga-3">
          <v-icon v-if="details.err.Level === 'error'" icon="mdi-alert-circle-outline" color="error"></v-icon>
          <v-icon v-else-if="details.err.Level === 'warning'" icon="mdi-alert" color="warning"></v-icon>
          <v-icon v-else icon="mdi-information-outline" color="info"></v-icon>
          <h6 class="text-h6 text-capitalize">{{ formatLevel(details.err.Level) }}</h6>
        </v-card-title>

        <v-card-text>
          <p :class="'p-log-' + details.err.Level" class="p-log-message text-body-2 text-selectable" dir="ltr">
            <span class="font-weight-medium">{{ formatTime(details.err.Time) }}</span
            >&puncsp;<span class="text-break">{{ details.err.Message }}</span>
          </p>
        </v-card-text>

        <v-card-actions>
          <v-btn color="button" variant="flat" class="action-close" @click="details.show = false">
            {{ $gettext(`Close`) }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { DateTime } from "luxon";
import $api from "common/api";
import PConfirmAction from "component/confirm/action.vue";

export default {
  name: "PPageErrors",
  components: {
    PConfirmAction,
  },
  data() {
    const query = this.$route.query;
    const q = query["q"] ? query["q"] : "";

    return {
      dirty: false,
      loading: false,
      scrollDisabled: false,
      scrollDistance: window.innerHeight * 2,
      filter: { q },
      isPublic: this.$config.get("public"),
      batchSize: 100,
      offset: 0,
      page: 0,
      errors: [],
      dialog: {
        delete: false,
      },
      details: {
        show: false,
        err: { Level: "", Message: "", Time: "" },
      },
    };
  },
  computed: {
    density() {
      return this.$vuetify.display.smAndDown ? "compact" : "comfortable";
    },
  },
  watch: {
    $route() {
      const query = this.$route.query;
      this.filter.q = query["q"] ? query["q"] : "";
      this.onReload();
    },
  },
  created() {
    if (this.$config.deny("logs", "view")) {
      this.$router.push({ name: "albums" });
      return;
    }

    this.loadMore();
  },
  methods: {
    updateFilter(props) {
      if (!props || typeof props !== "object" || props.target) {
        return;
      }

      for (const [key, value] of Object.entries(props)) {
        if (!this.filter.hasOwnProperty(key)) {
          continue;
        }
        switch (typeof value) {
          case "string":
            this.filter[key] = value.trim();
            break;
          default:
            this.filter[key] = value;
        }
      }
    },
    updateQuery(props) {
      this.updateFilter(props);

      if (this.loading) return;

      const query = {};

      Object.assign(query, this.filter);

      for (let key in query) {
        if (query[key] === undefined || !query[key]) {
          delete query[key];
        }
      }

      if (JSON.stringify(this.$route.query) === JSON.stringify(query)) {
        return;
      }

      this.$router.replace({ query });
    },
    showDetails(err) {
      this.details.err = err;
      this.details.show = true;
    },
    onDelete() {
      if (this.loading) {
        return;
      }

      this.dialog.delete = true;
    },
    onConfirmDelete() {
      this.dialog.delete = false;

      if (this.loading) {
        return;
      }

      this.loading = true;
      this.scrollDisabled = true;

      // Delete error logs.
      $api.delete("errors")
        .then((resp) => {
          if (resp && resp.data.code && resp.data.code === 200) {
            this.errors = [];
            this.dirty = false;
            this.page = 0;
            this.offset = 0;
          }
        })
        .finally(() => {
          this.scrollDisabled = false;
          this.loading = false;
        });
    },
    onReload() {
      if (this.loading) {
        return;
      }

      this.page = 0;
      this.offset = 0;
      this.scrollDisabled = false;

      this.loadMore();
    },
    loadMore() {
      if (this.scrollDisabled) return;

      if (this.offset === 0) {
        this.loading = true;
      }

      this.scrollDisabled = true;

      const count = this.dirty ? (this.page + 2) * this.batchSize : this.batchSize;
      const offset = this.dirty ? 0 : this.offset;
      const q = this.filter.q;

      const params = { count, offset, q };

      // Fetch error logs.
      $api.get("errors", { params })
        .then((resp) => {
          if (!resp.data) {
            resp.data = [];
          }

          if (offset === 0) {
            this.errors = resp.data;
          } else {
            this.errors = this.errors.concat(resp.data);
          }

          this.scrollDisabled = resp.data.length < count;

          if (!this.scrollDisabled) {
            this.offset = offset + count;
            this.page++;
          }
        })
        .finally(() => {
          this.loading = false;
          this.dirty = false;
        });
    },
    level(s) {
      return s.substring(0, 4).toUpperCase();
    },

    localTime(s) {
      if (!s) {
        return this.$gettext("Unknown");
      }

      return DateTime.fromISO(s).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
    },
    formatLevel(level) {
      switch (level) {
        case "error":
          return this.$gettext("Error");
        case "warning":
          return this.$gettext("Warning");
      }

      return level;
    },
    formatTime(s) {
      if (!s) {
        return this.$gettext("Unknown");
      }

      return DateTime.fromISO(s).toFormat("yyyy-LL-dd HH:mm:ss");
    },
  },
};
</script>
