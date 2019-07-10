<template>
  <v-container>
    <v-layout
      text-xs-center
      wrap
    >
      <v-flex xs12>
        <h2 v-text="status" />
        <span>Automatically checks for updates every 15 seconds.</span>
        <template v-if="notificationsEnabled">
          <v-btn @click="notify" v-if="status === 'Online'">
            Show a silent notification with trip status
          </v-btn>
          <v-btn @click="notify" v-else>
            Notify me when I can call
          </v-btn>
        </template>
        <span v-else>Background notifications are disabled in your browser</span>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import localforage from 'localforage'

interface Trip {
  id: string
  name: string
  driver: string
  wentOnline: boolean
  notify: boolean
}

@Component
export default class ViewStatus extends Vue {
  status: string = 'Loading...'
  cancelToken: number = 0
  lastUpdated: number = 0
  notificationsEnabled: boolean = false
  @Prop({ type: String, required: true }) readonly code!: string

  async mounted() {
    self.addEventListener('message', (event) => {
      this.status = event.data.status
      clearInterval(this.cancelToken)
      this.cancelToken = setInterval(this.refresh, 15000)
    })
    document.addEventListener('visibilitychange', (event) => {
      clearInterval(this.cancelToken)
      if (document.visibilityState === 'visible') {
        this.cancelToken = setInterval(this.refresh, 15000)
        if (Date.now() - this.lastUpdated > 5000) {
          this.refresh()
        }
      }
    })
    window.addEventListener('unload', (event) => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(this.code)
      }
    })
    if (document.visibilityState === 'visible') {
      this.cancelToken = setInterval(this.refresh, 15000)
      await this.refresh()
    }
    const registration = await self.navigator.serviceWorker.ready
    let trip = await localforage.getItem<Trip>(this.code)
    if (!trip) {
      const subscription = await registration.pushManager.subscribe()
      const { id, name, driver, timestamp, status } = await fetch('/subscribe', { method: 'POST', body: JSON.stringify({ subscription, code: this.code }) }).then(res => res.json())
      trip = { id, name, driver, wentOnline: status === 'Online', notify: false }
      await localforage.setItem<Trip>(this.code, trip)
      this.status = status
      this.lastUpdated = timestamp
    } else {
      await this.refresh()
    }
    if (Notification.permission === 'denied') {
      return
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        return
      }
    }
    registration.showNotification(`${name}'s Trip`, {
      body: this.status,
      tag: trip.driver,
      data: {
        code: this.code
      },
      timestamp: this.lastUpdated,
      silent: true
    })
    this.notificationsEnabled = true
  }

  async refresh() {
    const { status }: { status: string } = await fetch(`/status?code=${encodeURIComponent(this.code)}`).then(res => res.json())
    this.status = status
    this.lastUpdated = Date.now()
  }

  async notify() {
    let trip: Trip = await localforage.getItem(this.code)
    trip.notify = true
    await localforage.setItem(this.code, trip)
  }
}
</script>
