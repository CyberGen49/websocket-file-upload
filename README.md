# Websocket File Upload Test
This repository contains an experiment in which you can upload files over a websocket. I made this mostly to satisfy my own curiosity, but there may be circumstances where this is superior to normal chunked file uploads over HTTP. I would imagine that things would slow down once SSL is introduced (`wss` as opposed to just `ws`).

To try it out:
* Clone the repository
* Run `npm install`
* Start the server with `node server.js`
* Open [localhost:8080]