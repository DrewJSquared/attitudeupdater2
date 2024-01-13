# attitudeupdater2
Updater script for the 2nd gen attitude control hardware

## Updating base file
Update device ID and serial number in id.json file
`cd Documents` `cd attitude` `nano id.json` change ID and SN

Update SSH service script
`sudo nano /etc/systemd/system/attitudessh.service`
change SN digits



# Installation from scratch...

## Initial download:
`cd ~/Documents && curl -L -O https://github.com/drewjsquared/attitudeupdater2/archive/master.zip && unzip master.zip && mv attitudeupdater2-main attitude && rm -r master.zip`

## Install NVM
`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash `
Once this script finishes, open a new terminal window so NVM will take effect. 

## Install NodeJS, NPM, & PM2
`nvm install 16 && npm install pm2 -g`

## Download Latest Source Code
`cd ~/Documents/attitude && curl -L -O https://github.com/drewjsquared/attitudecontrol2/archive/master.zip && unzip master.zip && mv attitudecontrol2-main AttitudeControl && rm -r master.zip`

## Setup PM2 Processes
`cd ~/Documents/attitude/AttitudeControl && pm2 start ecosystem.config.js && pm2 save && pm2 startup`
(and copy/paste startup script to save startup)

## Setup SSH
Enable SSH: `sudo raspi-config` Interface Options -> SSH -> Enable

Install autossh & test connection: `sudo apt install autossh && autossh -R attitudecontrol-00100XX:22:localhost:22 serveo.net`
(Be sure to change the serial number!)
(and test connection and accept key for Serveo.net else it wont work!!!)

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
ExecStart=autossh -R attitudecontrol-00200XX:22:localhost:22 serveo.net

[Install]
WantedBy=multi-user.target
```
(Be sure to change the serial number!)

Start service: `systemctl start attitudessh.service && systemctl enable attitudessh.service`
