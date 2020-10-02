#!/usr/bin/node
/*
Make a small listener that Domoticz can connect to as if it was the real otmonitor application. 
Then relay the messages between OTGW and Domoticz such that otmonitor is still fully functional.

author: ernorv

v2.0 
	- rewrote the OpenTherm parts to be splitted into separate function
	- added check whether port are actually opened, if no connection to OTGW, wait ten seconds and retry 
		this can happen if starting both this script and OTGW, where OTGW needs some time
	- added check if we could open a port for Domoticz, now nicely goes out of the function without throwing an error
	- added specific author section for debugging purposes
	- fieldnumberInPsOutputToReplace was actually off with 1, so now if you set it to 11, it will be 11 according to the list below
	- for older node versions, plug in the repeat function for string.
*/

var portNumberForDomoticzToUse     =  process.env.portNumberForDomoticzToUse || 7689;   // The new port that Domoticz needs to use. In Domoticz, set this number as the port under the OTGW hardware
var portNumberOfOtMonitor          =  process.env.portNumberOfOtMonitor || 7686;   // The network port OTGW provides, as can be set under the Configuration parts
const replaceTTwithTC              =  process.env.replaceTTwithTC || true;   // If true: use TC instead of TT (if false, just standard Domoticz TT usage)

// -------------- Normally no further settings required below this line
var resetOTGW_PS_state             =  process.env.resetOTGW_PS_state || true; // default true: sets the PS state back to 0 after Domoticz has its data, is what allows otmonitor to keep making nice graphs as if Domoticz was not there

// -------------- just if you really know what you do, set these
var replaceAnIdInDomoticzOutput    =  process.env.replaceAnIdInDomoticzOutput || false; // default: false! set this to true for replacement of the DHW Setpoing with Solar Temperature
var idToUseForReplacement          =  process.env.idToUseForReplacement || 29;   // (Decimal) ID of the Opentherm message to use. 29 refers to the Solar Boiler Temperature
var fieldnumberInPsOutputToReplace =  process.env.fieldnumberInPsOutputToReplace || 11;   // which field to replace in PS output to replace, see numbers below

/*
	The PS1 output has 25 field: see http://otgw.tclcode.com/firmware.html#dataids
	
	The OTGW outputs the following fields (normally that is). I have given them below. Set the 'fieldnumberInPsOutputToReplace' to the 
	fieldnumber in accordance with what you like to be replace, given these fields (default is 16):
	
	1)  Status (MsgID=0) - Printed as two 8-bit bitfields
	2)  Control setpoint (MsgID=1) - Printed as a floating point value
	3)  Remote parameter flags (MsgID= 6) - Printed as two 8-bit bitfields
	4)  Maximum relative modulation level (MsgID=14) - Printed as a floating point value
	5)  Boiler capacity and modulation limits (MsgID=15) - Printed as two bytes
	6)  Room Setpoint (MsgID=16) - Printed as a floating point value
	7)  Relative modulation level (MsgID=17) - Printed as a floating point value
	8)  CH water pressure (MsgID=18) - Printed as a floating point value
	9)  Room temperature (MsgID=24) - Printed as a floating point value
	10) Boiler water temperature (MsgID=25) - Printed as a floating point value
	11) DHW temperature (MsgID=26) - Printed as a floating point value
	12) Outside temperature (MsgID=27) - Printed as a floating point value
	13) Return water temperature (MsgID=28) - Printed as a floating point value
	14) DHW setpoint boundaries (MsgID=48) - Printed as two bytes
	15) Max CH setpoint boundaries (MsgID=49) - Printed as two bytes
	16) DHW setpoint (MsgID=56) - Printed as a floating point value
	17) Max CH water setpoint (MsgID=57) - Printed as a floating point value
	18) Burner starts (MsgID=116) - Printed as a decimal value
	19) CH pump starts (MsgID=117) - Printed as a decimal value
	20) DHW pump/valve starts (MsgID=118) - Printed as a decimal value
	21) DHW burner starts (MsgID=119) - Printed as a decimal value
	22)	Burner operation hours (MsgID=120) - Printed as a decimal value
	23)	CH pump operation hours (MsgID=121) - Printed as a decimal value
	24) DHW pump/valve operation hours (MsgID=122) - Printed as a decimal value
	25) DHW burner operation hours (MsgID=123) - Printed as a decimal value
	
*/

// ------------- do not use, specific for author ---------------
var   extraDebug      = false;
const authorOverrides = false; // for anybody out there, keep this to false !!! 

if (authorOverrides) {
	portNumberForDomoticzToUse     = 17689;   // for test, do not interrupt normal running process, so throw it somewhere else
	portNumberOfOtMonitor          = 7686; 
	resetOTGW_PS_state             = false;   // not to interfere with the actual program already runing
    replaceAnIdInDomoticzOutput    = true;    // default: false! set this to true for replacement of the DHW Setpoing with Solar Temperature
	idToUseForReplacement          = 25;      // (Decimal) ID of the Opentherm message to use. I use 25 for test purposes
	fieldnumberInPsOutputToReplace = 11;      // which field to replace in PS output to replace, see list above
	extraDebug = true;
}


// ----------------------------------------------------------

var net = require('net');
var server 
var otgwSocket
var domSocketsArray = [];

// -------------- DEFINE SERVER LISTENING FOR CONNECTIONS FROM DOM ---------------
server = net.createServer(function (socket) {
	console.log('Incoming Domoticz Connection...');
	domSocketsArray.push(socket);
	
	socket.on('data', function (data) {
		data = data.toString(); // data may come in as Buffer
		console.log('DOM: ' + data.replace(/[\r\n]*$/, "").replace(/\r\n/g, ','));
		if (! otgwSocket.destroyed) {
			if (replaceTTwithTC) {
				otgwSocket.write(data.replace("TT=", "TC="));
			} else {
				otgwSocket.write(data);
			};
		}
	});

	socket.on('end', function() {
		console.log('end');
		domSocketsArray.splice(domSocketsArray.indexOf(socket), 1);
	});
	
	socket.on('error', function () {
		console.log('DOM: detected error on socket: probably otgwSocket died');	
		domSocketsArray.splice(domSocketsArray.indexOf(socket), 1);
	});
	
	socket.on('close', function () {
		console.log('DOM: socket closed');
		domSocketsArray.splice(domSocketsArray.indexOf(socket), 1);
	});
});

server.on('error', function(err) {
	console.log('Could not open the port ' + portNumberForDomoticzToUse + ' for Domoticz to connect to.');
	console.log('Please check whether the port is actually free to use, and adapt the "portNumberForDomoticzToUse" in the script.');
	console.log('A common source for this is that one uses the port number of the OTGW instead of a free one.')
	process.exit(1);
});


// ---------------- CONNECT TO OTGW ----------------
function relayToClients(data) {
	for (var i =0 ; i < domSocketsArray.length; i++) {
		if (! domSocketsArray[i].destroyed) {
			domSocketsArray[i].write(data);
		}
	}
}

var resetPS1 = false;
var currentReplacementValue = 0; // init this with 0

function connectToOTGW() {
	
	otgwSocket = net.createConnection({port: portNumberOfOtMonitor}, function() {
	  console.log('Connected to OTGW server at port number ' + portNumberOfOtMonitor + '!');
	});

	otgwSocket.on('data', function(data) {
		data = data.toString(); // data comes in as Buffer, we want to use it as string
		
		if (data.match(/[BTARE][0-9ABCDEF,]{8}/)) {
			// this data is not for Domoticz, it is what makes the normal otmonitor app work
			// console.log('<not relayed> OTGW: ' + data.toString().replace("\r", '').replace('\n', ''));
			
			// this data can contain a possible value for replacement purposes, inspect it.
			if (replaceAnIdInDomoticzOutput || extraDebug) {
				var otObj = parseMessage(data);
				if (replaceAnIdInDomoticzOutput && (otObj.readAck || otObj.writeAck) && (otObj.otMsgId == idToUseForReplacement)) {
					currentReplacementValue = (otObj.recognized) ? otObj.valstr : otObj.asFloat.toFixed(2);
					console.log("New replacement value found: (msgid " + otObj.otMsgId + ": '" + otObj.name + "') : " + currentReplacementValue);
				}
			}			
		} else {
			
			console.log('OTGW : ' + data.replace(/[\r\n]*$/, "").replace(/\r\n/g, ','));
			// sometimes there is a PR:,I=00 on the line which ends up in Domoticz status log. It looks like
			// malfomed data coming from the OTGW itself. Let's do some cleaning up, keeping the status log clean
			data = data.replace(/PR:[ ]*,/g, "PR: ");
			data = data.replace(/PR, /g, "PR: ");
			// a difficult one: this happens every so often, a comma missing in the output of the OTGW PS=0 output, let's repair this
			data = data.replace(/([01]{8}\/[01]{8},[0-9\.]{4,6},[01]{8}\/[01]{8})([0-9\.]{4,6}.*)/, "$1,$2");
			
			/* Now we can replace a field in the output to Domoticz with another one, as long as the one to read has also a 
			 * floating point definition (bit technical, but if you like, google for the specification of the Opentherm itself).
			 * This implies that we can only put it into a Domoticz field that also understand this floating point definition. 
			 * Most temperatures are by the way. Also the (Opentherm ID) needs to be filled in. These are both done above in the 
			 * const definition section of the script. 
			 */
			
			if (replaceAnIdInDomoticzOutput) {
				tmp = data.split(',')
				if (tmp.length == 25) { // for the PS1 output we expect 25 fields: see http://otgw.tclcode.com/firmware.html#dataids
					tmp[fieldnumberInPsOutputToReplace-1] = currentReplacementValue;
					data = tmp.join(",");
					console.log("RPLC : " + data.replace(/[\r\n]*$/, ""));
				}
			}
			relayToClients(data);
		}
		
		if (data.indexOf('PS: 1') !== -1 ) {
			// Domoticz is issueing a PS1 command, reset it if indicated by the settings above
			resetPS1 = resetOTGW_PS_state;
		};
		if (resetPS1 && (data.match(/[01]{7,9}\/[01]{7,9},.*/))) {
			// ok the data requested by domoticz has been produced, now go back to normal otmonitor operation
			otgwSocket.write('PS=0\r\n'); // no need to test for destroyed here, data just arrived from it
			resetPS1 = false;
		};
	});

	otgwSocket.on('end', function() {
		console.log('OTGW disconnected from server, reconnecting in 1 second.');
		setTimeout(function() { connectToOTGW(); }, 1000)
	});
	
	otgwSocket.on('error', function(err) {
		console.log('==> Could not connect to the OTGW at port ' + portNumberOfOtMonitor);
		console.log('==> Make sure the OTGW is running and set to provide the port as given above.');
		console.log('==> Will try to reconnect in 10 seconds, maybe OTGW is just starting up here.');
		setTimeout(function() { connectToOTGW(); }, 10000);
	});
	
	otgwSocket.on('close', function() {
		console.log('otgwSocket Close part');
	});
}

//-------------------------- function for extra debug --------------------

// apparently the String.repeat does not always exists, depending on Node version, define one if needed
if (typeof(String.prototype.repeat) == 'undefined') {
    console.log('String.repeat does not exist, adding a prototype definition (normal for older NodeJS versions).');
	String.prototype.repeat = function(n) {
		var tmpstr = "";
		for (var i=0; i < n; i++) tmpstr += this ;
		return tmpstr
	}
}


// the following is a list of already known IDs and how to convert them
// otdef[OTMSGIDasDecimal] = {'readable name', '[asFlags|asFloat|asUInt|asSInt|asFlags]'
var otdef  = {};
otdef[0]   = {name:"Master and slave status flags", val:"asFlags"}; // read ack: slave, read-data: master
otdef[5]   = {name:"Application Specific Flags", val: "asFlags"};
otdef[9]   = {name:"Remote Override Room Setpoint", val: "asFloat"};
otdef[14]  = {name:"Maximum Relative Modulation Level", val: "asFloat"};
otdef[16]  = {name:"Room Setpoint", val: "asFloat"};
otdef[17]  = {name:"Relative Modulation Level", val: "asFloat"};
otdef[18]  = {name:"Water Pressure", val: "asFloat"};
otdef[24]  = {name:"Room Temperature", val: "asFloat"};
otdef[25]  = {name:"Boiler Water Temperature", val: "asFloat"};
otdef[26]  = {name:"DHW Temperature", val: "asFloat"};
otdef[27]  = {name:"Outside Temperature", val: "asFloat"};
otdef[28]  = {name:"Return Water Temperature", val: "asFloat"};
otdef[29]  = {name:"Solar Boiler Temperature", val: "asFloat"};
otdef[56]  = {name:"DHW Setpoint", val: "asFloat"};
otdef[57]  = {name:"Max CH water Setpoint", val: "asFloat"};
otdef[100] = {name:"Remote Override Function", val: "asROF"};
otdef[120] = {name:"Burner Operation Hours", val: "asUInt"};
otdef[121] = {name:"CH Pump Operation Hours", val: "asUInt"};
otdef[122] = {name:"DHW Pump/Valve Operation Hours", val: "asUInt"};

function parseMessage(data) {
	/*
	 * this function parses those B12345678 like messages and returns the information
	 * in case it is either a read-ack or a write-ack, such to simplify the msgs as 
	 * from the OTGW side. The instruction before are not so interesting, as we would
	 * like to see the actual information in the datastreams.
	 */
	
	// byte 2 is data-id, byte 3 and 4 contain the data value
	// byte 1: parity bit, 3 bits msg type and 4 bits spare, hence mind the parity
	
	data = data.substr(0,9);  // remove extra newline stuff
	data = data[0] + (parseInt(data[1], 16)&0x7) + data.substr(2); // remove that parity bit for more consistent reading
	
	var otObject = {recognized: false,
					readData  : parseInt(data.substr(1,1), 16) == 0,
					writeData : parseInt(data.substr(1,1), 16) == 1,
					readAck   : parseInt(data.substr(1,1), 16) == 4,
					writeAck  : parseInt(data.substr(1,1), 16) == 5,
					otMsgId   : parseInt(data.substr(3,2), 16), 
					asFloat   : ((parseInt(data.substr(5,2))&0x80)>0?-1:1) * 
								((parseInt(data.substr(5,2), 16)&0x7F) + (parseInt(data.substr(7,2), 16))/256.0 ), 
					asUInt    : parseInt(data.substr(5,4), 16), 
					asSInt    : ((parseInt(data.substr(5,4), 16) + 0x8000) & 0xFFFF)-0x8000,
					asStatus  : "",
					data      : data};		
		
	var valstr
	var value
	
	if (otdef[otObject.otMsgId]) {
		otObject.recognized = true;
		switch (otdef[otObject.otMsgId].val) {
			case "asFloat" :
				valstr = otObject[otdef[otObject.otMsgId].val].toFixed(2);
				value  = otObject[otdef[otObject.otMsgId].val];
				break;
				
			case "asFlags":
				var tmpstr = (otObject.asUInt >>> 8).toString(2);
				valstr = ("0").repeat(8-tmpstr.length) + tmpstr + "/" ;
				tmpstr = ((otObject.asUInt >>> 0)&0xFF).toString(2);
				valstr += ("0").repeat(8-tmpstr.length) + tmpstr;
				value  = otObject["asUInt"];
				break;
				
			case "asROF": // remote override function: the TT/TC, special treatment here
				var tmpstr = (otObject.asUInt >>> 8).toString(2);
				valstr = ("0").repeat(8-tmpstr.length) + tmpstr + "/" ;
				tmpstr = ((otObject.asUInt >>> 0)&0xFF).toString(2);
				valstr += ("0").repeat(8-tmpstr.length) + tmpstr;
				otObject.asStatus = ((otObject.asUInt & 0x0300) ? (((otObject["asUInt"] & 0x0100) ? "TC" : "TT")) : "") ;
				value = valstr;
				break;
				
			default :
				valstr = otObject[otdef[otObject.otMsgId].val] + "";
				value  = otObject[otdef[otObject.otMsgId].val];
		}
		
		otObject.name = otdef[otObject.otMsgId].name;
		otObject.valstr = valstr;
		otObject.value  = value;
	} else {
		// unknown id used here, do not know how to convert
	}
	
	if ((otObject.otMsgId != 1) & (otObject.otMsgId != 1) & 
	    (otObject.readAck | otObject.writeAck) & extraDebug) { // 0 is the standard status report, bit boring
		if (otObject.recognized) {
			console.log(otObject.data.replace(/[\n\l\r]/g, "") +" ("+otObject.otMsgId+")" + " " + otObject.name + " : " + otObject.valstr);
		} else {
			console.log(otObject.data.replace(/[\n\l\r]/g, "") + " : " + JSON.stringify(otObject));
		}
	}
	
	return otObject
} // parseMessage

// instruct this program to connect to the otmonitor application
connectToOTGW();

// ---------------------- start the server for active listening ----------------
server.listen(portNumberForDomoticzToUse, function() {
   console.log('Server for Domoticz is now listening, point Domoticz OTGW Hardware to port '+ portNumberForDomoticzToUse + '.');
});

console.log('Application started.');