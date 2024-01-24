FROM --platform=linux/amd64 node:18-bullseye AS builder

WORKDIR /app/

COPY package*.json ./
RUN npm install

COPY . .

FROM --platform=linux/amd64 node:18-bullseye

RUN apt update
RUN apt install -y tzdata xvfb libopengl-dev libuv1-dev
RUN wget http://archive.ubuntu.com/ubuntu/pool/main/libj/libjpeg-turbo/libjpeg-turbo8_2.0.3-0ubuntu1_amd64.deb && apt install -y ./libjpeg-turbo8_2.0.3-0ubuntu1_amd64.deb
RUN wget http://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu70_70.1-2_amd64.deb && apt install -y ./libicu70_70.1-2_amd64.deb
RUN wget http://archive.ubuntu.com/ubuntu/pool/main/i/icu/icu-devtools_70.1-2_amd64.deb && apt install -y ./icu-devtools_70.1-2_amd64.deb
WORKDIR /app/

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/src ./src/

EXPOSE 8080
ENTRYPOINT ["node", "src/cli.js"]
