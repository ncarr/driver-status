FROM node:10-alpine
WORKDIR /home/node/app
COPY package.json .
ENV NODE_ENV=production
RUN yarn --production=false --silent --non-interactive
COPY . .
RUN yarn build
CMD [ "yarn", "start" ]