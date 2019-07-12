<template>
  <v-container>
    <v-toolbar app>
      <v-btn icon to="/">
        <v-icon>arrow_back</v-icon>
      </v-btn>
      <v-toolbar-title v-text="`${name}'s Trip`" />
    </v-toolbar>
    <v-layout
      text-xs-center
      wrap
    >
      <v-flex xs12>
        <EnterCode @code="submitCode" @error="error = $event" />
        <p v-text="error" />
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import EnterCode from '@/components/EnterCode.vue'

@Component({
  components: {
    EnterCode
  }
})
export default class Home extends Vue {
  error: string = ''

  submitCode(code: string) {
    this.$router.push({
      name: 'status',
      params: {
        code
      }
    })
  }
}
</script>
