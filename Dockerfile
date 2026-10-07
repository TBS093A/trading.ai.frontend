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

# 1.27-alpine mial 2 CRITICAL (openssl) w Trivy. apk upgrade dociaga poprawki Alpine wydane po
# zbudowaniu obrazu bazowego; obraz bazowy dziala jako uid 101, wiec upgrade jako root i powrot.
FROM nginxinc/nginx-unprivileged:1.29-alpine

USER root
RUN apk upgrade --no-cache
USER 101

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080
