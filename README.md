# attitudeupdater

## Initial download:
`cd ~/Documents && curl -L -O https://github.com/drewjsquared/attitudeupdater/archive/master.zip && unzip master.zip && mv attitudeupdater-main attitude && rm -r master.zip`

## Install NVM
`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash `
Once this script finishes, open a new terminal window so NVM will take effect. 

## Install NodeJS, NPM, & PM2
`nvm install 16 && npm install pm2 -g`

## Download Latest Source Code
`cd ~/Documents/attitude && curl -L -O https://github.com/drewjsquared/attitudecontrol/archive/master.zip && unzip master.zip && mv attitudecontrol-main AttitudeControl && rm -r master.zip`

## Setup PM2 Processes
`cd ~/Documents/attitude/AttitudeControl && pm2 start AttitudeControl.js && cd ~/Documents/attitude && pm2 start autoupdate.js && pm2 save && pm2 startup`

## Setup SSH
Enable SSH: `sudo raspi-config` Interface Options -> SSH -> Enable

Install autossh & test connection: `sudo apt install autossh && autossh -R attitudecontrol-00100XX:22:localhost:22 serveo.net`
(Be sure to change the serial number!)

Setup service file: `sudo nano /etc/systemd/system/attitudessh.service`

Copy this into the new file: 
```
[Unit]
Description=Attitude SSH
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=attitude
ExecStart=autossh -R attitudecontrol-00100XX:22:localhost:22 serveo.net

[Install]
WantedBy=multi-user.target
```
(Be sure to change the serial number!)

Start service: `systemctl start attitudessh.service && systemctl enable attitudessh.service`
