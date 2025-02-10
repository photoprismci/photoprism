<template>
  <div id="p-dialogs">
    <p-photo-upload-dialog
      :visible="upload.visible"
      :data="upload.data"
      @close="upload.visible = false"
      @confirm="upload.visible = false"
    ></p-photo-upload-dialog>
    <p-photo-edit-dialog
      :visible="edit.visible"
      :selection="edit.selection"
      :index="edit.index"
      :album="edit.album"
      :tab="edit.tab"
      @close="edit.visible = false"
    ></p-photo-edit-dialog>
    <p-update :visible="update.visible" @close="update.visible = false"></p-update>
    <p-lightbox></p-lightbox>
  </div>
</template>
<script>
import Album from "model/album";

import PPhotoUploadDialog from "component/photo/upload/dialog.vue";
import PPhotoEditDialog from "component/photo/edit/dialog.vue";
import PUpdate from "component/update.vue";
import PLightbox from "component/lightbox.vue";

export default {
  name: "PDialogs",
  components: {
    PPhotoEditDialog,
    PPhotoUploadDialog,
    PUpdate,
    PLightbox,
  },
  data() {
    return {
      update: {
        visible: false,
      },
      upload: {
        visible: false,
        data: {},
      },
      edit: {
        visible: false,
        album: null,
        selection: [],
        index: 0,
        tab: "",
      },
      subscriptions: [],
    };
  },
  created() {
    // Opens the web upload dialog.
    this.subscriptions.push(
      this.$event.subscribe("dialog.upload", (ev, data) => {
        this.openUpload(data);
      })
    );

    // Opens the photo edit dialog.
    this.subscriptions.push(
      this.$event.subscribe("dialog.edit", (ev, data) => {
        if (this.hasAuth() && !this.edit.visible) {
          this.edit.visible = true;
          this.edit.index = data.index;
          this.edit.selection = data.selection;
          this.edit.album = data.album;
          this.edit.tab = data?.tab ? data.tab : "";
        }
      })
    );

    // Opens the update dialog so that users can reload the UI after updates.
    this.subscriptions.push(
      this.$event.subscribe("dialog.update", () => {
        if (!this.update.visible) {
          this.update.visible = true;
        }
      })
    );
  },
  unmounted() {
    for (let i = 0; i < this.subscriptions.length; i++) {
      this.$event.unsubscribe(this.subscriptions[i]);
    }
  },
  methods: {
    hasAuth() {
      return this.$session.auth || this.isPublic;
    },
    isReadOnly() {
      return this.$config.get("readonly");
    },
    openUpload(data) {
      if (this.upload.visible || !this.hasAuth() || this.isReadOnly() || !this.$config.feature("upload")) {
        return;
      }

      if (this.$route.name === "album" && this.$route.params?.album) {
        return new Album()
          .find(this.$route.params?.album)
          .then((m) => {
            this.upload.visible = true;
            this.upload.data = Object.assign({ albums: [m] }, data);
          })
          .catch(() => {
            this.upload.visible = true;
            this.upload.data = Object.assign({ albums: [] }, data);
          });
      } else {
        this.upload.visible = true;
        this.upload.data = Object.assign({ albums: [] }, data);
      }
    },
  },
};
</script>
