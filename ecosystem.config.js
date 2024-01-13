module.exports = {
	apps : [
		{
			name   : "AttitudeControl2",
			script : "AttitudeControl2.js",
			cwd: "./AttitudeControl/",
			min_uptime: 10000,
			max_restarts: 10,
			// exp_backoff_restart_delay: 100,
		},
		{
			cwd: "./",
			name   : "autoupdate2.js",
			script : "autoupdate2.js",
		},
		{
			cwd: "./",
			name   : "whitebackup",
			script : "whitebackup.js",
		},
	]
}