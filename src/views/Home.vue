<template>
  <v-container>
    <v-toolbar app>
      <v-toolbar-title>Open Trip</v-toolbar-title>
    </v-toolbar>
    <v-content>
      <v-layout
        text-xs-center
        wrap
      >
        <v-flex xs12>
          <EnterCode @code="submitCode" @error="error = $event" />
          <p v-text="error" />
        </v-flex>
        <v-flex xs12 v-if="trips.length > 0">
          <h2>Current Trips</h2>
          <v-card v-for="trip in trips" :key="trip.id" :to="{ name: 'status', params: { code: trip.code } }">
            <v-card-title v-text="`${trip.name}'s Trip`" />
          </v-card>
        </v-flex>
      </v-layout>
    </v-content>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import localforage from 'localforage'
import EnterCode from '@/components/EnterCode.vue'
import Trip from '@/plugins/Trip'

@Component({
  components: {
    EnterCode,
  },
})
export default class Home extends Vue {
  public error: string = ''
  public trips: Trip[] = []

  public async mounted() {
    const codes = await localforage.keys()
    this.trips = (await Promise.all(codes.map((code) =>
      localforage.getItem<Trip>(code).then((trip) => (trip && { code, ...trip }))))).filter((trip) => trip)
  }

  public submitCode(code: string) {
    this.$router.push({
      name: 'status',
      params: {
        code,
      },
    })
  }
}
</script>
