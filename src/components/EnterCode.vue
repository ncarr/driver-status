<template>
  <v-container>
    <v-layout
      text-xs-center
      wrap
    >
      <v-flex xs12>
        <v-text-field
          v-model="code"
          label="Share link or code"
        />
        <v-btn @click="submit">
          View Status
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
export default class EnterCode extends Vue {
  code: string = ''

  submit() {
    this.$emit('code', this.code)
  }
}
</script>

<style>

</style>
