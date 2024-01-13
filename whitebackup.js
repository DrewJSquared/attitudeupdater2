// whitebackup.js
// a script to output white on all universes in case the primary attitude script fails
// copyright 2024 Drew Shipps, J Squared Systems



// ==================== OPTIONS ====================
var UNIVERSES = 8;
var INTERVAL = 1000;
var PROCESS_NAME = 'AttitudeControl2';
var DEBUG = false;



// ==================== IMPORT ====================
const log = require('npmlog');
var e131 = require('e131');



// ==================== VARIABLES ====================
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