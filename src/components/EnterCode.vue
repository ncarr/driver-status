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
        <v-btn @click="submit()">
          View Status
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
export default class EnterCode extends Vue {
  public code: string = ''

  public async submit() {
    const n = this.code.lastIndexOf('/')
    const code = this.code.substring(n + 1)
    const result = await fetch(`/api/status?code=${encodeURIComponent(code)}`)
    const data = await result.json()
    if (result.status !== 200) {
      this.$emit('error', data.error)
      return
    }
    if (data.status === 'Offline') {
      this.$emit('error', 'The trip is over')
      return
    }
    this.$emit('code', code)
  }
}
</script>

<style>

</style>
