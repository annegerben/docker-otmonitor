FROM ubuntu:latest
LABEL maintainer="AG"

ENV TZ=Europe/Amsterdam
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apt-get update && apt-get install -y wget bash libxft2 libxss1 nodejs

RUN mkdir /app && mkdir /data \
  && /usr/bin/wget http://otgw.tclcode.com/download/otmonitor-x64 -O /app/otmonitor \
  && chmod +x /app/otmonitor	

COPY entrypoint.sh /entrypoint.sh 
RUN chmod a+x /entrypoint.sh

#The new port that Domoticz needs to use. In Domoticz, set this number as the port under the OTGW hardware
ENV portNumberForDomoticzToUse=7689		
#The network port OTGW provides, as can be set under the Configuration parts
ENV portNumberOfOtMonitor=7686
#If true: use TC instead of TT (if false, just standard Domoticz TT usage)
ENV replaceTTwithTC=true
	#-------------- Normally no further settings required below this line
#default true: sets the PS state back to 0 after Domoticz has its data, is what allows otmonitor to keep making nice graphs as if Domoticz was not there
ENV resetOTGW_PS_state=true
	#-------------- just if you really know what you do, set these
#default: false! set this to true for replacement of the DHW Setpoing with Solar Temperature
ENV replaceAnIdInDomoticzOutput=false
#(Decimal) ID of the Opentherm message to use. 29 refers to the Solar Boiler Temperature
ENV idToUseForReplacement=29
#which field to replace in PS output to replace, see numbers below
ENV fieldnumberInPsOutputToReplace=11

COPY otgw.js ./	

#EXPOSE 7777
ENTRYPOINT [ "/entrypoint.sh" ]
