<template>
  <div class="p-page p-page-support" tabindex="1">
    <v-toolbar
      flat
      :density="$vuetify.display.smAndDown ? 'compact' : 'default'"
      class="page-toolbar"
      color="secondary"
    >
      <v-toolbar-title>
        {{ $gettext(`Contact Us`) }}
      </v-toolbar-title>

      <v-btn icon>
        <v-icon size="26" color="surface-variant">mdi-message-text</v-icon>
      </v-btn>
    </v-toolbar>
    <div v-if="sent" class="pa-6">
      <h3 class="text-h6 font-weight-bold pt-6 pb-2 text-center">
        {{ $gettext(`We appreciate your feedback!`) }}
      </h3>
      <p class="text-body-2 py-6 text-center">
        {{
          $gettext(
            `Due to the high volume of emails we receive, our team may be unable to get back to you immediately.`
          )
        }}
        {{ $gettext(`We do our best to respond within five business days or less.`) }}
      </p>
      <p class="mt-6 text-center">
        <img src="https://cdn.photoprism.app/thank-you/colorful.png" width="100%" alt="THANK YOU" />
      </p>
    </div>
    <v-form v-else ref="form" v-model="valid" autocomplete="off" class="pa-4" validate-on="invalid-input">
      <v-row dense>
        <v-col cols="12">
          <v-select
            v-model="form.Category"
            validate-on="invalid-input"
            :disabled="busy"
            :items="options.FeedbackCategories()"
            item-title="text"
            item-value="value"
            :label="$gettext('Category')"
            color="surface-variant"
            hide-details
            autocomplete="off"
            class="input-category"
            :rules="[(v) => !!v || $gettext('Required')]"
          ></v-select>
        </v-col>

        <v-col cols="12">
          <v-textarea
            v-model="form.Message"
            validate-on="invalid-input"
            auto-grow
            hide-details
            autocomplete="off"
            rows="10"
            :rules="[(v) => !!v || $gettext('Required')]"
            :label="$gettext('How can we help?')"
          ></v-textarea>
        </v-col>

        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.UserName"
            validate-on="invalid-input"
            hide-details
            autocomplete="off"
            color="surface-variant"
            :label="$gettext('Name')"
            type="text"
          >
          </v-text-field>
        </v-col>

        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.UserEmail"
            hide-details
            autocapitalize="none"
            color="surface-variant"
            :rules="[(v) => !!v || $gettext('Required')]"
            :label="$gettext('E-Mail')"
            type="email"
          >
          </v-text-field>
        </v-col>

        <v-col cols="12" class="d-flex grow">
          <v-btn
            color="highlight"
            class="ml-0"
            :disabled="!form.Category || !form.Message || !form.UserEmail"
            @click.stop="send"
          >
            {{ $gettext(`Send`) }}
            <v-icon end>mdi-send</v-icon>
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
    <p-about-footer></p-about-footer>
  </div>
</template>

<script>
import * as options from "options/options";
import $api from "common/api";
import PAboutFooter from "component/about/footer.vue";

export default {
  name: "PPageSupport",
  components: {
    PAboutFooter,
  },
  data() {
    return {
      sent: false,
      busy: false,
      valid: false,
      options: options,
      form: {
        Category: "feedback",
        Message: "",
        UserName: "",
        UserEmail: "",
        UserAgent: navigator.userAgent,
        UserLocales: navigator.language,
      },
      rtl: this.$rtl,
    };
  },
  mounted() {
    this.$view.enter(this);
  },
  unmounted() {
    this.$view.leave(this);
  },
  methods: {
    send() {
      if (this.$refs.form.validate()) {
        $api.post("feedback", this.form).then(() => {
          this.$notify.success(this.$gettext("Message sent"));
          this.sent = true;
        });
      } else {
        this.$notify.error(this.$gettext("All fields are required"));
      }
    },
  },
};
</script>
