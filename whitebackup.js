// whitebackup.js
// a script to output white on all universes in case the primary attitude script fails
// copyright 2024 Drew Shipps, J Squared Systems



// ==================== OPTIONS ====================
var UNIVERSES = 8;
var INTERVAL = 10000;
var PROCESS_NAME = 'AttitudeControl2';
var DEBUG = false;



// ==================== IMPORT ====================
const log = require('npmlog');
var e131 = require('e131');
var fs = require('fs');
const https = require("https");
const { SerialPort } = require('serialport');



// ==================== VARIABLES ====================
var DEVICE_ID = 0;
var SERIALNUMBER = 'AC-00200XX';

var LED_COLOR = 'C';
var LAPTOP_MODE = (process.platform == 'darwin');

var tickCounter = 1;
var whiteCounter = 1;



// ==================== INITIALIZE ====================
log.notice('WHITEBACKUP', 'Initializing white backup system...');
log.notice('WHITEBACKUP', 'Copyright 2024 Drew Shipps, J Squared Systems');
log.notice('WHITEBACKUP', 'A script to output white on ' + UNIVERSES + ' universes if the primary Attitude script fails.');
log.notice('WHITEBACKUP', '-- Interval set to ' + INTERVAL + 'ms');



// ==================== INTERVAL SCRIPT ====================
setInterval(function () {
	// log that the interval is running, with a counter to tell difference between successive logs
	log.notice('WHITEBACKUP', 'TICK #' + tickCounter);

	// increment tick counter (just to tell if the app is alive)
	tickCounter++;
	if (tickCounter > 1000000) {
		tickCounter = 1;
	}


	// now check with PM2 if the script is running
	require('child_process').exec('pm2 jlist', function (error, stdout, stderr) {
		// catch error
	    if (error !== null) {
	        log.error('WHITEBACKUP', '`pm2 jlist` exec error ' + error);
	        console.log('exec error: ' + error);
	    }

	    // if there was a response
	    if (stdout.length > 0) {
	    	// attempt to parse response
	    	var jsonResult = JSON.parse(stdout) ?? 'fail';

	    	// if successful
	    	if (jsonResult != 'fail') {
	    		// debug log that we parsed the JSON
	    		if (DEBUG) { log.notice('WHITEBACKUP', 'Successfully parsed JSON.'); }

	    		// if the process length is less than 1, there's no PM2 processes in the array
	    		if (jsonResult.length < 1) {
	    			log.error('WHITEBACKUP', 'No pm2 processes found! FAILED!')
	    		}

	    		// now go thru each result in the JSON list of pm2 processes running
	    		for (var i = 0; i < jsonResult.length; i++) {

	    			// if this process name is equal to PROCESS_NAME then it's the one to check
	    			if (jsonResult[i].pm2_env.name == PROCESS_NAME) {

	    				// log that we found the app
	    				if (DEBUG) { log.notice('WHITEBACKUP', 'Correctly found app named ' + PROCESS_NAME); }

	    				// check if it's online
	    				if (jsonResult[i].pm2_env.status == 'online') {
	    					// if so, debug log that it's online and reset the white counter
	    					if (DEBUG) { log.notice('WHITEBACKUP', 'App ' + PROCESS_NAME + ' is online :)'); }
	    					whiteCounter = 0;
	    				} else {
	    					// otherwise log that it's offline and log the counter
	    					log.notice('WHITEBACKUP', 'App ' + PROCESS_NAME + ' is OFFLINE! Output white on ' 
	    						+ UNIVERSES + ' universes. Counter: ' + whiteCounter);

	    					// increment counter to show time offline
	    					whiteCounter++;
	    					if (whiteCounter > 1000000) {
	    						whiteCounter = 0;
	    					}

	    					// output all white to # of universes
	    					var clients = [];
							var packets = [];
							var slotsDatas = [];

							// loop thru each universe and set it up to output
							for (var i = 0; i < UNIVERSES; i++) {
								// create client
								clients[i] = new e131.Client(i+1);
								packets[i] = clients[i].createPacket(512);
								slotsDatas[i] = packets[i].getSlotsData();

								// configure packet
								packets[i].setSourceName('Attitude sACN Client');
								packets[i].setUniverse(i + 1);
								packets[i].setOption(packets[i].Options.PREVIEW, false);
								packets[i].setPriority(1);
							}

							// loop through each universe and set it to all white and push a packet out
							for (var u = 0; u < UNIVERSES; u++) {
								// set slots to white
								for (var i = 0; i < 512; i++) {
									slotsDatas[u][i] = 255;
								}

								// send over sACN
								clients[u].send(packets[u], function () {
									// console.log('sent callback');
								});
							}


							// carefully attempt to tell the LEDs on the front to be a certain color
							try {
								updateLEDpanel();
							}
							catch (err) {
								log.error('LED ERROR', err)
							}


							// NOW send a quick ping to the attitude server to say that we are currently white only at this location
							// first load device ID from id.json so we know which device this is
							loadDeviceID(function () {
								// (callback for once ID loaded)

								// setup url
								var url = 'https://attitude.lighting/api/devices/' + DEVICE_ID + '/whitebackup';

								log.http('AUTOUPDATE', 'Attempting to let the attitude.lighting server know that we are white only.');
								log.http('AUTOUPDATE', 'URL: ' + url);

								// actual https get
								https.get(url, resp => {
									let data = "";

									// process each chunk
									resp.on("data", chunk => {
										data += chunk;
									});

									// finished, do something with result
									resp.on("end", () => {
										if (resp.statusCode == 200) {
											// 200 ok response so continue
											log.http('WHITEBACKUP', 'Attitude.lighting server responded "' + data + '"');
											log.http('WHITEBACKUP', 'HTTPS ping to attitude.lighting complete :)');
										} else {
											// anything else is bad news and means something is wrong with the server or request
											log.error('HTTPS', 'Error status code is ' + resp.statusCode);
											log.error('WHITEBACKUP', 'Failed, unable to inform the server of the white only status.');
										}
									});
								}).on("error", err => {
									log.error('HTTPS', 'Error: ' + err.message);
									log.error('WHITEBACKUP', 'Unable to get ping attitude.lighting server about white only!');
								});
							});
	    				}
	    			}
	    		}
	    	} else {
	    		log.error('WHITEBACKUP', 'UNABLE TO PARSE JSON... WHITEBACKUP FAILED!')
	    	}
	    } else {
    		log.error('WHITEBACKUP', 'stdout length = 0, no response from pm2! FAILED!')
    	}
	});	
}, INTERVAL);


// updateLEDpanel - send a message via serial port to LED panel to change color, then close port
function updateLEDpanel () {
	// set up port path
	var portPath = '/dev/ttyACM0';
	if (LAPTOP_MODE) {
		portPath = '/dev/cu.usbmodem1201';
	}

	// init port
	const port = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: false, });

	// attempt to open port
	port.open(function (err) {
		if (err) {
			log.error('WHITEBACKUP LED', err.message);
			log.error('WHITEBACKUP LED', ' --- ' + new Date().toLocaleTimeString() + ' ---  err on open in init func')
		} else {
			log.info('WHITEBACKUP LED', 'Connected to Raspberry Pi Pico. ');

			port.write(LED_COLOR, function(err) {
				if (err) {
					log.error('WHITEBACKUP LED', 'Error on write: ', err.message);
				}

				log.info('WHITEBACKUP LED', 'Data sent! Closing port...');

				port.close();
			});
		}
	});
}


// loadDeviceID - load Device ID from id.json
function loadDeviceID(callback) {
	var path = './id.json';

	try {
	  	let rawdata = fs.readFileSync(path);
	
	  	try {
		  	let data = JSON.parse(rawdata);

			DEVICE_ID = data.device_id;
			SERIALNUMBER = data.serialnumber;

			// if either does not update properly then crash the app
			if (!Number.isInteger(DEVICE_ID) || typeof SERIALNUMBER != 'string') {
				log.error('WHITEBACKUP', 'Failed to find Device ID and/or Serial Number. Web ping will not be possible.');
			}

		  	log.info('WHITEBACKUP', 'Device ID: ' + DEVICE_ID + ', Serial Number: ' + SERIALNUMBER);

		  	callback();
		}
		catch(err) {
		  	log.error('WHITEBACKUP', 'JSON.parse(rawdata) error or some other error inside callback...');
		  	log.error('WHITEBACKUP', 'Error: ' + err.message);
		}
	}
	catch(err) {
	  	log.error('WHITEBACKUP', 'id.json file not found! Failed to load device ID!');
	  	log.error('WHITEBACKUP', 'Error: ' + err.message);
	}
}