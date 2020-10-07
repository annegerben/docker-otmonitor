#!/bin/sh
FILE=/data/otmonitor.conf
if [ -f "$FILE" ]; then
    echo "$FILE exists."
else 
    echo "$FILE does not exist, copy $file to /data"
	cp ./otmonitor.conf ./data/otmonitor.conf 
fi

cd /data
/app/otmonitor --daemon -f /data/otmonitor.conf &
sleep 10
cd /
node otgw.js &
/bin/bash