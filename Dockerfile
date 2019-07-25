FROM node:10-alpine AS frontend-build
WORKDIR /home/node/app
COPY package.json .
ENV NODE_ENV=production
RUN yarn --production=false --silent --non-interactive
COPY . .
RUN yarn build

FROM nginx:1.17-alpine AS proxy
COPY --from=frontend-build /home/node/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf