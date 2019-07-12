<template>
  <v-container>
    <v-toolbar app>
      <v-btn icon to="/">
        <v-icon>arrow_back</v-icon>
      </v-btn>
      <v-toolbar-title v-text="name" />
    </v-toolbar>
    <v-layout
      text-xs-center
      wrap
    >
      <v-flex xs12>
        <h2 v-text="status" />
        <span>Automatically checks for updates every 15 seconds.</span>
        <template v-if="notificationsEnabled && !notified">
          <v-btn @click="notify" v-if="status === 'Online'">
            Show a silent notification with trip status
          </v-btn>
          <v-btn @click="notify" v-else>
            Notify me when I can call
          </v-btn>
        </template>
        <p v-else-if="!notificationsEnabled">Permission to send notifications was denied for this website</p>
        <p v-else>You are subscribed to notifications for this trip</p>
        <p v-text="error" />
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import localforage from 'localforage'
import { Route } from 'vue-router'

Component.registerHooks([
  'beforeRouteUpdate'
])

interface Trip {
  id: string
  name: string
  driver: string
  wentOnline: boolean
  notify: boolean
}

@Component
export default class ViewStatus extends Vue {
  name: string = 'Loading...'
  status: string = 'Loading...'
  error: string = ''
  cancelToken: number = 0
  lastUpdated: number = 0
  notificationsEnabled: boolean = true
  notified: boolean = false

  get code() {
    return this.$route.params.code
  }

  async mounted() {
    await this.refresh()
    if (this.status === 'Offline') {
      this.notificationsEnabled = false
      return
    }
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
    }
    const registration = await self.navigator.serviceWorker.ready
    // Everything below will only run after the ServiceWorker is ready
    let trip = await localforage.getItem<Trip>(this.code)
    if (!trip) {
      const subscription = await registration.pushManager.subscribe()
      const { id, name, driver, timestamp, status } = await fetch('/subscribe', { method: 'POST', body: JSON.stringify({ subscription, code: this.code }) }).then(res => res.json())
      trip = { id, name, driver, wentOnline: status === 'Online', notify: false }
      await localforage.setItem<Trip>(this.code, trip)
      this.status = status
      this.lastUpdated = timestamp
    }
    if (Notification.permission === 'denied') {
      this.notificationsEnabled = false
    }
  }

  destroyed() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(this.code)
    }
  }

  beforeRouteUpdate(to: Route, from: Route, next: () => void) {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(this.code)
    }
    next()
  }

  async refresh() {
    const { status, name, error } = await fetch(`/status?code=${encodeURIComponent(this.code)}`).then(res => res.json())
    if (error) {
      this.error = error
      return
    }
    this.status = status
    this.name = `${name}'s Trip`
    this.lastUpdated = Date.now()
  }

  async notify() {
    if (Notification.permission === 'denied') {
        this.notificationsEnabled = false
      return
    }
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      this.error = 'Service worker not registered'
      return
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        this.notificationsEnabled = false
        return
      }
    }
    let trip: Trip = await localforage.getItem(this.code)
    trip.notify = true
    await localforage.setItem(this.code, trip)
    registration.showNotification(`${name}'s Trip`, {
      body: this.status,
      tag: trip.driver,
      data: {
        code: this.code
      },
      timestamp: this.lastUpdated,
      silent: true
    })
    this.notified = true
  }
}
</script>
