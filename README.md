# driver-status
### Notifies you when you can call a driver

## Project setup

Create encryption keys for notifications:
```
docker run --rm -ti nicholascarr/driver-status-server yarn -s generate-keys > vapid.json
```

Add a `subject` key with your URL or mailto link to `vapid.json`.

Create the secret in Docker:
```
cat vapid.json | docker secret create vapid -
```

## Running the app

```
docker stack deploy -c docker-compose.yml driver-status
```

## Stopping the app

```
docker stack rm driver-status
```
