FROM buildpack-deps:jammy

RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

WORKDIR /app

# Combine update, install and cleanup steps to reduce layer size
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libglfw3-dev \
    libuv1-dev \
    libpng-dev \
    libicu-dev \
    libjpeg-turbo8-dev \
    libwebp-dev \
    xvfb \
    x11-utils \
    clang \
    git \
    cmake \
    ccache \
    ninja-build \
    pkg-config \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json /app/
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION v20.11.0

# Install nvm, node, npm and cleanup in a single RUN to reduce layer size
RUN mkdir -p $NVM_DIR \
  && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
  && . $NVM_DIR/nvm.sh \
  && nvm install $NODE_VERSION \
  && nvm use --delete-prefix $NODE_VERSION \
  && npm install \
  && nvm cache clear

ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH
ENV DISPLAY=:99.0

# Start Xvfb in the background
RUN start-stop-daemon --start --pidfile /tmp/xvfb.pid --make-pidfile --background --exec /usr/bin/Xvfb -- :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset

COPY ./src/* /app/src/
COPY entrypoint.sh /app
COPY ./tests/ /app/tests/
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT [ "/app/entrypoint.sh" ]
