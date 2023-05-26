FROM node:18-buster
WORKDIR /app

RUN apt update && apt -y install \
    build-essential \
    m4 \
    clang \
    wget

RUN wget --quiet https://gmplib.org/download/gmp/gmp-6.2.1.tar.xz && \
    tar xf ./gmp-6.2.1.tar.xz && \
    cd gmp-6.2.1 && \
    ./configure && \
    make && \
    make install && \
    cd .. && \
    rm -r gmp-6.2.1*

COPY package.json ./package.json
COPY yarn.lock ./yarn.lock

RUN yarn install --production

COPY src ./src
COPY src/core/numbers ./numbers

RUN cd /app/src/core && \
    mkdir bin && \
    make

EXPOSE 3000

CMD ["yarn", "start"]
