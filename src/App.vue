<template>
  <v-app>
    <v-toolbar app>
      <v-toolbar-title class="headline">
        <span>Driver Status</span>
      </v-toolbar-title>
    </v-toolbar>

    <v-content>
      <EnterCode @code="track" />
    </v-content>
  </v-app>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import EnterCode from './components/EnterCode.vue'
import ViewStatus from './components/ViewStatus.vue'

@Component({
  components: {
    EnterCode,
    ViewStatus
  }
})
export default class App extends Vue {
  
}
</script>
