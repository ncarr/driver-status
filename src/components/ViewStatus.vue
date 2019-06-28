<template>
  <v-container>
    <v-layout
      text-xs-center
      wrap
    >
      <v-flex xs12>
        <span v-text="timeElapsed" />
        <v-btn @click="notify">
          Notify me
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component';

@Component({
  props: {
    code: String
  }
})
export default class ViewStatus extends Vue {
  lastRefresh: number = Date.now()

  refresh() {
    // axios to server
  }

  notify() {
    // axios to server
    // invoke service worker
  }

  get timeElapsed() {
    return `Last refreshed ${(Date.now() - this.lastRefresh) / 1000}`
  }
}
</script>

<style>

</style>
