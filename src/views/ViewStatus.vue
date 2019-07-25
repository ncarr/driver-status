<template>
  <v-container>
    <v-toolbar app>
      <v-btn icon to="/">
        <v-icon>arrow_back</v-icon>
      </v-btn>
      <v-toolbar-title v-text="name" />
    </v-toolbar>
    <v-content>
      <v-layout
        text-xs-center
        wrap
      >
        <v-flex xs12>
          <h2 v-text="status" />
          <p>Automatically checks for updates every 15 seconds.</p>
          <template v-if="status !== 'Offline'">
            <p v-if="!notificationsEnabled">Permission to send notifications was denied for this website</p>
            <template v-else-if="notified">
              <p>You are subscribed to notifications for this trip</p>
              <v-btn @click="unsubscribe">
                Unsubscribe
              </v-btn>
            </template>
            <v-btn @click="notify" v-else-if="status === 'Online'">
              Show a silent notification with trip status
            </v-btn>
            <v-btn @click="notify" v-else>
              Notify me when I can call
            </v-btn>
          </template>
          <p v-text="error" />
        </v-flex>
      </v-layout>
    </v-content>
  </v-container>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import localforage from 'localforage'
import { Route } from 'vue-router'
import Trip from '@/plugins/Trip'

Component.registerHooks([
  'beforeRouteUpdate',
])

@Component
export default class ViewStatus extends Vue {
  public name: string = 'Loading...'
  public status: string = 'Loading...'
  public error: string = ''
  public cancelToken: number = 0
  public lastUpdated: number = 0
  public notificationsEnabled: boolean = true
  public notified: boolean = false
  public code: string = ''

  public async mounted() {
    this.code = this.$route.params.code
    await this.refresh()
    if (this.status === 'Offline') {
      this.notificationsEnabled = false
      return
    }
    // Arrow functions to preserve 'this'
    self.navigator.serviceWorker.onmessage = (event) => {
      if (event.data.unsubscribe) {
        this.notified = false
        return
      }
      this.status = event.data.status
      clearInterval(this.cancelToken)
      this.cancelToken = setInterval(() => this.refresh(), 15000)
    }
    document.onvisibilitychange = (event) => {
      clearInterval(this.cancelToken)
      if (this.status !== 'Offline' && document.visibilityState === 'visible') {
        this.cancelToken = setInterval(() => this.refresh(), 15000)
        if (Date.now() - this.lastUpdated > 5000) {
          this.refresh()
        }
      }
    }
    self.onunload = (event) => {
      this.teardown()
    }
    if (document.visibilityState === 'visible') {
      this.cancelToken = setInterval(() => this.refresh(), 15000)
    }
    const registration = await self.navigator.serviceWorker.ready
    // Everything below will only run after the ServiceWorker is ready
    let trip = await localforage.getItem<Trip>(this.code)
    if (!trip) {
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: await fetch('/api/publickey').then((res) => res.arrayBuffer()),
        userVisibleOnly: true,
      })
      const { id, name, driver, timestamp, status } = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription, code: this.code }),
      }).then((res) => res.json())
      trip = { id, name, driver, wentOnline: status === 'Online', notify: false }
      await localforage.setItem<Trip>(this.code, trip)
      this.status = status
      this.lastUpdated = timestamp
    } else {
      this.notified = trip.notify
    }
    if (Notification.permission === 'denied') {
      this.notificationsEnabled = false
    }
  }

  public beforeDestroy() {
    this.teardown()
  }

  public beforeRouteUpdate(to: Route, from: Route, next: () => void) {
    this.teardown()
    this.code = to.params.code
    next()
  }

  public async refresh() {
    const { status, name, error } = await fetch(`/api/status?code=${encodeURIComponent(this.code)}`)
      .then((res) => res.json())
    if (error) {
      this.error = error
      return
    }
    this.status = status
    this.name = `${name}'s Trip`
    this.lastUpdated = Date.now()
    if (status === 'Offline') {
      clearInterval(this.cancelToken)
      this.cancelToken = 0
    }
  }

  public async notify() {
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
    const trip: Trip = await localforage.getItem(this.code)
    trip.notify = true
    await localforage.setItem(this.code, trip)
    await registration.showNotification(this.name, {
      body: this.status,
      tag: trip.driver,
      data: {
        code: this.code,
      },
      timestamp: this.lastUpdated,
      silent: true,
    })
    this.notified = true
  }

  public async unsubscribe() {
    const trip: Trip = await localforage.getItem(this.code)
    trip.notify = false
    await localforage.setItem(this.code, trip)
    this.notified = false
  }

  public teardown() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(this.code)
    }
    clearInterval(this.cancelToken)
    self.navigator.serviceWorker.onmessage = null
    document.onvisibilitychange = null
    self.onunload = null
  }
}
</script>
