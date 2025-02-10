<template>
  <v-dialog :model-value="visible" persistent max-width="350" class="p-dialog p-service-delete" @keydown.esc="close">
    <v-card>
      <v-card-title class="d-flex justify-start align-center ga-3">
        <v-icon size="54" color="primary">mdi-delete-outline</v-icon>
        <p class="text-subtitle-1">{{ $gettext(`Are you sure you want to delete this account?`) }}</p>
      </v-card-title>
      <v-card-actions class="action-buttons mt-1">
        <v-btn variant="flat" color="button" class="action-cancel action-close" @click.stop="close">
          {{ $gettext(`Cancel`) }}
        </v-btn>
        <v-btn variant="flat" color="highlight" class="action-confirm" @click.stop="confirm">
          {{ $gettext(`Delete`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script>
export default {
  name: "PServiceDelete",
  props: {
    visible: Boolean,
    model: {
      type: Object,
      default: () => {},
    },
  },
  data() {
    return {
      loading: false,
    };
  },
  watch: {
    visible: function (show) {
      if (show) {
        this.$view.enter(this);
        this.loading = false;
      } else {
        this.$view.leave(this);
      }
    },
  },
  methods: {
    close() {
      this.$emit("close");
    },
    confirm() {
      if (this.loading) {
        return;
      }

      this.loading = true;

      this.model
        .remove()
        .then(() => {
          this.$notify.success(this.$gettext("Account deleted"));
          this.$emit("confirm");
        })
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
</script>
