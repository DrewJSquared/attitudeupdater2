// reboot.js
// script to reboot, manual update, or delete config file
// copyright 2024 Drew Shipps, J Squared Systems



// ==================== OPTIONS ====================
var INTERVAL = 60000; // 60000 for 60s



// ==================== IMPORT ====================
const log = require('npmlog');
var fs = require('fs');
const https = require("https");



// ==================== VARIABLES ====================
var DEVICE_ID = 0;
var SERIALNUMBER = 'AC-00200XX';



// ==================== INITIALIZE ====================
log.notice('REBOOT SCRIPT', 'Initializing reboot system...');
log.notice('REBOOT SCRIPT', 'Copyright 2024 Drew Shipps, J Squared Systems');
log.notice('REBOOT SCRIPT', 'A script to reboot, manual update, or delete config file upon command via attitude.lighting server.');
log.notice('REBOOT SCRIPT', '-- Interval set to ' + INTERVAL + 'ms');



// ==================== INTERVAL SCRIPT ====================
setInterval(function () {
	// log that the interval is running, with a counter to tell difference between successive logs
	log.notice('REBOOT SCRIPT', 'Running interval to ping attitude.lighting server...');

	pingAttitudeServer();
}, INTERVAL);

// load device ID one-time, immediately
loadDeviceID();

// run ping to server one-time immediately
log.notice('REBOOT SCRIPT', 'Running interval to ping attitude.lighting server...');
pingAttitudeServer();



// ==================== FUNCTIONS ====================

// pingAttitudeServer - ping attitude server for parameters
function pingAttitudeServer() {
	// setup url
	var url = 'https://attitude.lighting/api/devices/' + DEVICE_ID + '/rebootoptions';

	log.http('REBOOT SCRIPT', 'Attempting to ping the attitude.lighting server for reboot options. (011924)');
	log.http('REBOOT SCRIPT', 'URL: ' + url);

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
				log.http('REBOOT SCRIPT', 'Attitude.lighting server responded "' + data + '"');
				log.http('REBOOT SCRIPT', 'HTTPS ping to attitude.lighting complete :)');

				var split = data.split(',');
				// console.log(split);

				// 0 - reboot, 1 - manual update, 2 - config

				// if config (needs to be first)
				// also added to restart pm2 
				if (split[2] == '1') {
					log.notice('REBOOT SCRIPT', 'Attitude server said to DELETE CONFIG!');
					console.log('+++++ DELETE CONFIG +++++');

					fs.rmSync('./AttitudeControl/config.json', { recursive: true, force: true });
					log.info('REBOOT SCRIPT', 'Config deleted! Restarting PM2...');

					// attempt to pm2 restart 0
					require('child_process').exec('pm2 restart 0', function (error, stdout, stderr) {
						// catch error
					    if (error !== null) {
					        log.error('REBOOT SCRIPT', '`pm2 restart 0` exec error ' + error);
					        console.log('exec error: ' + error);
					    } else {
					    	log.info('stdout', stdout);
					    	log.info('stderr', stderr);
							log.info('REBOOT SCRIPT', 'PM2 restart complete!');
					    }
					});
				}

				// if manual update (needs to be second)
				if (split[1] == '1') {
					log.notice('REBOOT SCRIPT', 'Attitude server said to MANUAL UPDATE!');
					console.log('+++++ MANUAL UPDATE +++++');

					// attempt to run manual update
					require('child_process').exec('node manualupdate2.js', function (error, stdout, stderr) {
						// catch error
					    if (error !== null) {
					        log.error('REBOOT SCRIPT', '`node manualupdate2.js` exec error ' + error);
					        console.log('exec error: ' + error);
					    } else {
					    	log.info('stderr', stderr);
							log.info('REBOOT SCRIPT', 'Updated attitude control script! Restarting PM2...');

							// attempt to restart pm2 0
							require('child_process').exec('pm2 restart 0', function (error, stdout, stderr) {
								// catch error
							    if (error !== null) {
							        log.error('REBOOT SCRIPT', '`pm2 restart 0` exec error ' + error);
							        console.log('exec error: ' + error);
							    } else {
							    	log.info('stdout', stdout);
							    	log.info('stderr', stderr);
									log.info('REBOOT SCRIPT', 'PM2 restart complete!');
							    }
							});
					    }
					});
				}

				// if reboot (needs to be last)
				if (split[0] == '1') {
					log.notice('REBOOT SCRIPT', 'Attitude server said to REBOOT!');
					console.log('+++++ REBOOT: FIRST DELETE CONFIG +++++');

					fs.rmSync('./AttitudeControl/config.json', { recursive: true, force: true });
					log.info('REBOOT SCRIPT', 'Config deleted! (so once the device boots it will load a fresh dataset) REBOOTING DEVICE...');
					console.log('+++++ REBOOT: NOW REBOOT DEVICE +++++');

					if (process.platform == 'darwin') {
						console.log('shutdown now');
					} else {
						// if manually updating too, then wait 1 min to shutdown
						if (split[1] == '1') {
							require('child_process').exec('sudo /sbin/shutdown -r 1', function (msg) { console.log(msg) });
						} else {
							require('child_process').exec('sudo /sbin/shutdown now', function (msg) { console.log(msg) });
						}
					}
				}
			} else {
				// anything else is bad news and means something is wrong with the server or request
				log.error('HTTPS', 'Error status code is ' + resp.statusCode);
				log.error('REBOOT SCRIPT', 'Failed, unable to ping the server for reboot options (BAD RESPONSE).');
			}
		});
	}).on("error", err => {
		log.error('HTTPS', 'Error: ' + err.message);
		log.error('REBOOT SCRIPT', 'Unable to get ping attitude.lighting server for reboot options! *OFFLINE*');
	});
}


// loadDeviceID - load Device ID from id.json
function loadDeviceID() {
	var path = './id.json';

	try {
	  	let rawdata = fs.readFileSync(path);
	
	  	try {
		  	let data = JSON.parse(rawdata);

			DEVICE_ID = data.device_id;
			SERIALNUMBER = data.serialnumber;

			// if either does not update properly then crash the app
			if (!Number.isInteger(DEVICE_ID) || typeof SERIALNUMBER != 'string') {
				log.error('REBOOT SCRIPT', 'Failed to find Device ID and/or Serial Number. Web ping will not be possible.');
			}

		  	log.info('REBOOT SCRIPT', 'Device ID: ' + DEVICE_ID + ', Serial Number: ' + SERIALNUMBER);
		}
		catch(err) {
		  	log.error('REBOOT SCRIPT', 'JSON.parse(rawdata) error or some other error inside callback...');
		  	log.error('REBOOT SCRIPT', 'Error: ' + err.message);
		}
	}
	catch(err) {
	  	log.error('REBOOT SCRIPT', 'id.json file not found! Failed to load device ID!');
	  	log.error('REBOOT SCRIPT', 'Error: ' + err.message);
	}
}