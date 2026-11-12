FROM golang:1.26-alpine AS builder
RUN apk add --no-cache git
WORKDIR /src
# Official source revision; upstream no longer distributes public container images.
RUN git init && git remote add origin https://github.com/minio/minio.git && \
    git fetch --depth 1 origin 7aac2a2c5b7c882e68c1ce017d8256be2feea27f && git checkout FETCH_HEAD
RUN CGO_ENABLED=0 go build -p 2 -trimpath -o /out/minio .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /out/minio /usr/bin/minio
ENTRYPOINT ["minio"]
