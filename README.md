# driver-status
### Notifies you when you can call a rideshare driver

## Project setup

Navigate to the project folder

Create a swarm:
```
docker swarm init
```

Create encryption keys for notifications:
```
docker run --rm -ti nicholascarr/driver-status-server yarn -s generate-keys > vapid.json
```

Add a `subject` key with your URL or mailto link to `vapid.json`.

(Optional) Copy the TLS certificate into the project folder and rename the files `app.crt` and `app.key`

## Running the app

Without HTTPS:
```
docker stack deploy -c docker-compose.yml driver-status
```

With HTTPS:
```
docker stack deploy -c docker-compose.yml -c docker-compose.https.yml driver-status
```

## Stopping the app

```
docker stack rm driver-status
```
