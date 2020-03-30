Multiuser card game

install:

sudo apt install nodejs
sudo apt install npm

npm init
npm install --save express socket.io nodemon




npm run start	// to kick the server off & auto-reload. But this gives errorsx

or
node server.js

or
nodemon server.js


node express EADDRINUSE error I get sometimes. It's because node continues to run in the background, holding the port open. Cure with:
killall node // to kill a node process running in the background after a crash
or find the pid & then sudo kill <pid>
