<template>
  <v-container>
    <v-layout
      text-xs-center
      wrap
    >
      <v-flex xs12>
        <h2 v-text="status" />
        <span>Automatically checks for updates every 15 seconds.</span>
        <v-btn @click="notify" v-if="status === 'Online'">
          Put status in a silent notification
        </v-btn>
        <v-btn @click="notify" v-else>
          Notify me when I can call
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import localforage from 'localforage'

@Component
export default class ViewStatus extends Vue {
  status: string = ''
  cancelToken: number = 0
  @Prop({ type: String, required: true }) readonly code!: string

// todo: move subscribe into mounted, trip list lifecycle
  async mounted() {
    if (document.visibilityState === 'visible') {
      this.cancelToken = setInterval(this.refresh, 15000)
    }
    self.addEventListener('message', (event) => {
      this.status = event.data.status
      clearInterval(this.cancelToken)
      this.cancelToken = setInterval(this.refresh, 15000)
    })
    document.addEventListener('visibilitychange', (event) => {
      clearInterval(this.cancelToken)
      if (document.visibilityState === 'visible') {
        this.refresh()
        this.cancelToken = setInterval(this.refresh, 15000)
      }
    })
  }

  async refresh() {
    const { status }: { status: string } = await fetch(`/status?code=${encodeURIComponent(this.code)}`).then(res => res.json())
    this.status = status
  }

  async notify() {
    const registration = await self.navigator.serviceWorker.getRegistration()
    if (registration) {
      const subscription = await registration.pushManager.subscribe()
      const data = await fetch('/subscribe', { method: 'POST', body: JSON.stringify({ subscription, code: this.code }) }).then(res => res.json())
      await localforage.setItem(subscription.endpoint, { code: this.code, ...data })
    }
  }
}
</script>