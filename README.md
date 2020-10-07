## Introduction
The Opentherm Monitor is a small utility that is intended to help you configure and monitor your opentherm gateway (OTGW).
And this container also has script (otgw.js) to run otmon parallel with Domoticz

## Run the image
Depending on your configuration you would start the image with something like:

```bash
docker run -d -p 7686:7686 -p 7689:7689 -p 8080:8080 
  -v $(pwd)/otmon/data:/data/
  annegerben/docker-otmonitor:latest
```

## Usage
Opentherm Monitor can be found on port 8080
Domoticz can now connect on port 7686

## More info
- [OpenTherm Monitor](http://otgw.tclcode.com/otmonitor.html)
- [otgw.js topic on the domoticz forum] https://www.domoticz.com/forum/viewtopic.php?t=12492
