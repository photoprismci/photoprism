<template>
  <v-dialog
    :model-value="visible"
    persistent
    max-width="360"
    class="p-dialog p-photo-delete-dialog"
    @keydown.esc="close"
  >
    <v-card>
      <v-card-title class="d-flex justify-start align-center ga-3">
        <v-icon size="54" color="primary">mdi-delete-outline</v-icon>
        <p v-if="text === ''" class="text-subtitle-1">
          {{ $gettext(`Are you sure you want to permanently delete these pictures?`) }}
        </p>
        <p v-else class="text-subtitle-1">{{ text }}</p>
      </v-card-title>
      <v-card-actions class="action-buttons mt-1">
        <v-btn variant="flat" color="button" class="action-cancel action-close" @click.stop="close">
          {{ $gettext(`Cancel`) }}
        </v-btn>
        <v-btn v-if="action === ''" color="highlight" variant="flat" class="action-confirm" @click.stop="confirm">
          {{ $gettext(`Delete`) }}
        </v-btn>
        <v-btn v-else color="highlight" variant="flat" class="action-confirm" @click.stop="confirm">
          {{ action }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script>
export default {
  name: "PPhotoDeleteDialog",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    text: {
      type: String,
      default: "",
    },
    action: {
      type: String,
      default: "",
    },
  },
  data() {
    return {};
  },
  methods: {
    close() {
      this.$emit("close");
    },
    confirm() {
      this.$emit("confirm");
    },
  },
};
</script>
