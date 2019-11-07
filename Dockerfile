FROM alpine:latest
MAINTAINER AGvA

#RUN apt-get update \
#  && apt-get install -y wget python3-tk \
#  && rm -rf /var/lib/apt/lists/*
RUN apk add --no-cache bash python3-tk 

RUN mkdir /app && mkdir /data \
  && /usr/bin/wget http://otgw.tclcode.com/download/otmonitor-x64 -O /app/otmonitor \
  && chmod +x /app/otmonitor

CMD ["/app/otmonitor", "--daemon", "-f", "/data/otmonitor.conf"]
