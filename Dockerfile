FROM node:24.12.0-bookworm AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# CRA bakes REACT_APP_* vars into the JS bundle at build time - they can't be
# changed at container runtime, must be passed as a build ARG.
ARG REACT_APP_API_URL=https://api.00x097.com
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV CI=true
ENV GENERATE_SOURCEMAP=false

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080
