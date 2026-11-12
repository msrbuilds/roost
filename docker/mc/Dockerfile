FROM golang:1.26-alpine AS builder
RUN apk add --no-cache git
WORKDIR /src
RUN git init && git remote add origin https://github.com/minio/mc.git && \
    git fetch --depth 1 origin 77f82e18b5401a65958f1619df6ebb994634bd88 && git checkout FETCH_HEAD
RUN CGO_ENABLED=0 go build -p 2 -trimpath -o /out/mc .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/mc /usr/bin/mc
ENTRYPOINT ["mc"]
