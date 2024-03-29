// autoupdate2.js
// automatic updater script for Attitude Control software 2nd gen
// copyright 2024 Drew Shipps, J Squared Systems


// imports
var log = require('npmlog');
var cron = require('node-cron');
var fs = require('fs');
const download = require('download-git-repo');
const https = require("https");


// cron update every night at 3am: 0 3 * * *
cron.schedule('0 3 * * *', () => {
	updater();
});


// variables
var DEVICE_ID = 0;
var SERIALNUMBER = 'AC-00200XX';

var updaterCounter = 0;
var downloadSuccess = false;
var downloadTimedOut = false;
var downloadFinishedFunctionRunning = false;
var currentCodeFound = false;
var backupCodeFound = false;
var moveCurrentToBackupSuccess = false;
var moveNewToCurrentSuccess = false;

var DOWNLOAD_TIMEOUT_LENGTH = 60000;


// primary update function
function updater() {
	log.info('AUTOUPDATE', 'Automatic Update Script for Attitude Control Device Firmware');
	log.info('AUTOUPDATE', ' +++ 2nd generation +++ (fix timing & add web req 011324)');
	log.info('AUTOUPDATE', 'Copyright 2023 Drew Shipps, J Squared Systems');

	// load device ID from id.json
	loadDeviceID(function () {
		// (callback for once ID loaded)

		// check attitude server for update via HTTPS (use device ID to see if an update is needed)
		checkAttitudeServerForUpdate(function () {
			// (callback in case an update is required)

			// now we finally attempt to update
			updaterCounter++;
			if (updaterCounter > 5) {
				log.error('AUTOUPDATE', 'This is sad. Autoupdaer attempted to run 5 times, but has somehow failed every single time! Unfortunately, this means this device will become offline until the next autoupdate cycle. Sorry!');
				restart();
			}

			// attempt to download new code
			downloadNewCode(function () {
				if (!downloadTimedOut) {
					downloadSuccess = true;

					downloadFinished();
				}
			});

			// after timeout interval passes, run finished function anyway
			setTimeout(function () {
				downloadFinished();
			}, DOWNLOAD_TIMEOUT_LENGTH);
		});
	});
}








// downloadFinished - once the download is finished or timed out, process code and update files
function downloadFinished() {
	if (!downloadFinishedFunctionRunning) {
		downloadFinishedFunctionRunning = true;
		// this ensures the function will only be called once

		downloadTimedOut = true;

		if (downloadSuccess) {
			checkForCurrent();
			checkForBackup();

			// give it 2 seconds to check for current and check for backup
			setTimeout(function () {
				if (currentCodeFound) {
					if (backupCodeFound) {
						deleteBackupCode(function () {
							moveCurrentToBackup(function () {
								moveCurrentToBackupSuccess = true;
							});
						});
					} else {
						moveCurrentToBackup(function () {
							moveCurrentToBackupSuccess = true;
						});
					}
				}

				// once we've cleared out current and backup as needed
				setTimeout(function () {
					if (currentCodeFound && !moveCurrentToBackupSuccess) {
						log.error('AUTOUPDATE', 'Failed to move current code to backup folder. Force removing current code if exists...');
						fs.rmSync('AttitudeControl', { recursive: true, force: true });
					}

					moveNewToCurrent(function () {
						moveNewToCurrentSuccess = true;
					});

					// once moved new to current
					setTimeout(function () {
						if (moveNewToCurrentSuccess) {
							log.info('AUTOUPDATE', 'Removing tmp folder...');
							fs.rmSync('tmp', { recursive: true, force: true });
							log.info('AUTOUPDATE', 'Removed tmp folder. Update successful!');
							restart();
						} else {
							revertBackupToCurrent(function () {
								log.error('AUTOUPDATE', 'Autoupdater failed to update to the new code, but successfully reverted to the previous version.');
								restart();
							});
						}
					}, 5000);
				}, 10000);
			}, 2000);
		} else {
			log.error('AUTOUPDATE', 'Download new code timed out!');
			restart();
		}
	}
}







// downloadNewCode - attempt to download new code and execute callback upon success
function downloadNewCode(callback) {
	log.info('AUTOUPDATE', 'Downloading new code...');

	// remove any old tmp code
	fs.rmSync('./tmp', { recursive: true, force: true });

	// download new code to tmp folder
	download('drewjsquared/attitudecontrol2', './tmp/AttitudeControl', function (err) {
		if (err) {
			log.error('AUTOUPDATE', err.message);
		} else {
			log.info('AUTOUPDATE', 'Download code success!');
			callback();
		}
	});
}


// checkForCurrent - check if there is any current code
function checkForCurrent() {
	fs.exists('AttitudeControl', function(exists) {
		if (exists) {
			log.info('AUTOUPDATE', 'Current code found.');
			currentCodeFound = true;
		} else {
			log.info('AUTOUPDATE', 'No current code found.');
		}
	});
}


// checkForBackup - check if there is any backup code
function checkForBackup() {
	fs.exists('backup', function(exists) {
		if (!exists) {
			log.error('AUTOUPDATE', 'No backup code folder found! Creating new folder now...');
			fs.mkdirSync('backup');
			log.info('AUTOUPDATE', 'Backup code folder created.');
		} else {
			fs.exists('backup/AttitudeControl', function(exists) {
				if (exists) {
					log.info('AUTOUPDATE', 'Backup code found.');
					backupCodeFound = true;
				} else {
					log.info('AUTOUPDATE', 'No backup code found.');
				}
			});
		}
	});
}


// deleteBackupCode - attempt to delete backup code and execute callback upon success
function deleteBackupCode(callback) {
	log.info('AUTOUPDATE', 'Removing backup code...');

	// only remove backup if current DOES EXIST
	fs.exists('AttitudeControl', function(exists) {
		if (exists) {
			fs.rmSync('backup/AttitudeControl', { recursive: true, force: true });
			fs.exists('backup/AttitudeControl', function(exists) {
				if (exists) {
					log.error('AUTOUPDATE', 'Remove backup code failed!');
				} else {
					log.info('AUTOUPDATE', 'Removed backup code.');
					callback();
				}
			});
		} else {
			log.error('AUTOUPDATE', 'Current code does not exist! Not removing backup code...');
		}
	});
}


// moveCurrentToBackup - check if there is any backup code
function moveCurrentToBackup(callback) {
	log.info('AUTOUPDATE', 'Moving current code to backup folder...');

	fs.exists('backup', function(exists) {
		if (!exists) {
			log.error('AUTOUPDATE', 'Backup folder does not exist! Creating new folder now...');
			fs.mkdirSync('backup');
		}

		fs.rename('AttitudeControl', 'backup/AttitudeControl', function (err) {
			if (err) {
				log.error('AUTOUPDATE', err.message);
			} else {
				log.info('AUTOUPDATE', 'Moved current code to backup folder.');
				callback();
			}
		});
	});
}


// moveNewToCurrent - move new code to current code directory
function moveNewToCurrent(callback) {
	log.info('AUTOUPDATE', 'Moving new code to current code folder...');
	fs.rename('./tmp/AttitudeControl', './AttitudeControl', function (err) {
		if (err) {
			log.error('AUTOUPDATE', err.message);
		} else {
			log.info('AUTOUPDATE', 'Moved new code to current code folder.');
			callback();
		}
	});
}


// revertBackupToCurrent - revert backup code to current code
function revertBackupToCurrent(callback) {
	log.info('AUTOUPDATE', 'Reverting backup code to current code...');

	fs.rmSync('AttitudeControl', { recursive: true, force: true });
	fs.exists('backup/AttitudeControl', function(exists) {
		if (exists) {
			fs.rename('backup/AttitudeControl', 'AttitudeControl', function (err) {
				if (err) {
					log.error('AUTOUPDATE', err.message);
				} else {
					log.info('AUTOUPDATE', 'Reverted backup code to current code.');
					callback();
				}
			});
		} else {
			log.info('AUTOUPDATE', 'No backup code found! Attempting to run updater again...');
			updater();
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
				log.error('AUTOUPDATE', 'Failed to initialize Device ID and/or Serial Number.');
				// process.exit();
			}

		  	log.info('AUTOUPDATE', 'Device ID: ' + DEVICE_ID + ', Serial Number: ' + SERIALNUMBER);

		  	callback();
		}
		catch(err) {
		  	log.error('AUTOUPDATE', 'JSON.parse(rawdata) error or some other error inside callback...');
		  	log.error('AUTOUPDATE', 'Error: ' + err.message);
			// process.exit();
		}
	}
	catch(err) {
	  	log.error('AUTOUPDATE', 'id.json file not found! Failed to load device ID!');
	  	log.error('AUTOUPDATE', 'Error: ' + err.message);
		// process.exit();
	}
}


// checkAttitudeServerForUpdate - check attitude server to see if an update is needed, if so call callback else exit
function checkAttitudeServerForUpdate(callback) {
	// setup url
	var url = 'https://attitude.lighting/api/devices/' + DEVICE_ID + '/autoupdate';

	log.http('AUTOUPDATE', 'Attempting to get the autoupdate flag from the attitude.lighting server.');
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

				// check data
				if (data == '1') {
					// update!
					log.http('AUTOUPDATE', '::: Update requested by attitude.lighting server! :::');
					log.info('AUTOUPDATE', 'Running automatic update script callback...');

					callback();
				} else if (data == '0') {
					// no need for update
					log.info('AUTOUPDATE', 'No update needed :)');
					log.info('AUTOUPDATE', 'Successfully completed autoupdate script!');
				} else {
					// unknown response
					log.error('HTTPS', 'Unknown response from server:');
					log.error('HTTPS', 'Data: ' + data);
					log.error('AUTOUPDATE', 'Autoupdate FAILED!');
					console.log('Autoupdate failed due to unknown data response');
				}
			} else {
				// anything else is bad news and means something is wrong with the server or request
				log.error('HTTPS', 'Error status code is ' + resp.statusCode);
				log.error('AUTOUPDATE', 'Autoupdate FAILED!');
				console.log('Autoupdate failed due to HTTPS status code ' + resp.statusCode);
			}
		});
	}).on("error", err => {
		log.error('HTTPS', 'Error: ' + err.message);
		log.error('AUTOUPDATE', 'Unable to get autoupdate status from attitude.lighting server! AUTOUPDATER FAILED!!');
	});
}


// restart - reboot device
function restart() {
	setTimeout(function () {
		log.info('AUTOUPDATE', 'Autoupdate complete. Rebooting device now...');

		require('child_process').exec('sudo /sbin/shutdown -r 1', function (msg) { console.log(msg) });
	}, 3000);
}