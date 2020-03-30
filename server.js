// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var util = require('util');

// Possibly slightly cleaner startup code here: https://socket.io/get-started/chat/
var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});// Start the server.

server.listen(5000, function() {
  console.log('Starting server on port 5000');
});

// https://stackify.com/node-js-debugging-tips/ 

// https://blog.heroku.com/best-practices-nodejs-errors Make sure it completely stops? Do the same for 'SIGTERM', 'SIGINT', 'SIGKILL'. nice simple module 
// https://stackoverflow.com/questions/4075287/node-express-eaddrinuse-address-already-in-use-kill-server
// https://nodejs.org/api/process.html#process_event_uncaughtexception
//process.on('uncaughtException', (err, origin) => {	
//  console.log(`dcm: Uncaught Exception: ${err.message}, origin: ${origin}`)
//  process.exit(1)
//})


// Utilities
function range(start, count) {
  return Array.apply(0, Array(count))
	.map(function (element, index) { 
	  return index + start;  
  });
}

function fillArrayWithRange(start, n) {	// https://2ality.com/2013/11/initializing-arrays.html, https://2ality.com/2012/07/apply-tricks.html
	var arr = Array.apply(null, Array(n));
	return arr.map(function (x, i) { return i+start });
}

// Campari Game Code

// Cards. 0 = no card, 1 = Ace Spades, 2 = 2 Spades, ..., 52 = King Hearts, 53 = Joker, 54 = rear of card
var cardDeck = {};		// the cards in the pick-up pile
var discards = [];		// cards that have been discarded
var cards = {};			// the cards as dealt & are displayed
let rear = 54;			// id of the image displaying the card's rear

var players = {};		// each client connection, keyed by the socket.id. Hard coded for 5 players currently.
var playerIDs = fillArrayWithRange(0, 5);	// allocated ids from this 'stack', and return them when the connection closes
var showAllCards = false;	// true when the game is over


function shuffleDeck(deck) {	// in-place shuffle
	for (let i=0; i<deck.length; i++) {
		let cardsRemaining = deck.length -i;
		let j = i + Math.floor(Math.random() * cardsRemaining);
		let temp = deck[i];
		deck[i] = deck[j];
		deck[j] = temp;
	}
	return deck;
}

function shuffle() {
	showAllCards = false;
	cardDeck = shuffleDeck(fillArrayWithRange(1, 53));	// cards start at no. 1, joker is included
	cards.players = [];
	for (let p=0; p<5; p++) {
		cards.players[p] = [ cardDeck.pop(), cardDeck.pop(), 0, cardDeck.pop(), cardDeck.pop(), 0];
	}
	discards = [];
	cards.drawarea = [0, 0, rear];	// weird - need to include this.
	console.log("Shuffled " + JSON.stringify(cards));
}

shuffle();

// https://socket.io/docs/server-api/ 

io.on('connection', function(socket) {
	let addr = socket.handshake.address;
	console.log("New connection, id is " + socket.id + ', ip addr: ' + addr);
	
	// config the new connection.
	playerIDs.sort();	// always allocated the lowest id first
	let playerID = playerIDs.shift();	// allocated the first available playerid. // todo check that an id is available.
	
    players[socket.id] = {
		x: 0,
		y: 0,
		id: playerID,
		mouseover: "",		// the element the mouse is currently over
		dragging: "",		// the element the mouse was over when there was a mousedown event, starting the drag operation
		cardID: 0,			// the card to display when dragging; 0 means no card being dragged
		socket: socket,
    };
	
	socket.emit('playerID', playerID);
	
  socket.on('disconnect', function(data) {
	console.log("player disconnected - id is " + socket.id);
	//if (players[socket.id] != null && players[socket.id] != undefined ) {
		console.log("deleting " + socket.id);
		playerIDs.unshift(players[socket.id].id);	// return the player id for re-use.
		delete players[socket.id];
	//}
  });
  
  socket.on('mouseover', function(data) {
	var player = players[socket.id] || {};
	player.mouseover = data;
	//console.log('mouseover - mouseover: ' + player.mouseover + ' dragging: ' + player.dragging);
  });
  
  socket.on('mousemove', function(data) {
	var player = players[socket.id] || {};
	player.x = data.x;
	player.y = data.y;
	player.buttons = data.buttons;
  });

  socket.on('mousedown', function(data) {
	//console.log('mousedown before - Mice ' + JSON.stringify(mice));
	var player = players[socket.id] || {};
	player.buttons = data.buttons;
	player.dragging = player.mouseover;
	player.x = data.x;
	player.y = data.y;
	
	// Decide whether to display the card being dragged
	player.cardID = 0;	// assume not to start with
	
	// drag from the pile
	if (player.dragging == 'D2' & cardDeck.length > 0) {
		// taking a card from the pile
		player.cardID = cardDeck[0];	// peek at the top card
	}
	
	if (player.dragging == 'D1' && discards.length > 0) {
		// taking a card from discards
		player.cardID = discards[0];	// peek at the top discard
	}
	
	if (player.dragging.startsWith('P')) {
		let ps = player.dragging.substr(1,1);
		let is = player.dragging.substr(2,1);
		player.cardID = cards.players[ps][is];
	}
			
  });

  socket.on('mouseup', function(data) {
	var player = players[socket.id] || {};
	player.buttons = data.buttons;
	player.x = data.x;
	player.y = data.y;
	
	
	// deal with button clicks
	if (player.mouseover == 'shuffle') {
		shuffle();
	}
	if (player.mouseover == 'showCards') {
		showAllCards = true;
	}
	
	// deal with drag completions
	// This is where much of the game logic goes
	if (player.dragging == 'D2') {
		// deal with taking a card from the pile
		if (cardDeck.length > 0) {
			// only do anything if there are cards on the pile
			if (player.mouseover == 'D1') {
				console.log('drag to display');
				if (cardDeck.length > 0) {
					discards.unshift(cardDeck.shift());
				}
			}
			if (player.mouseover.startsWith('P') ) {
				// dragging onto a player's card area.
				let p = player.mouseover.substr(1,1);
				let i = player.mouseover.substr(2,1);
				if (cards.players[p][i] > 0) {	// Is a card there already? If so, put the existing card onto the discard pile
					discards.unshift(cards.players[p][i]);
				}
				cards.players[p][i] = cardDeck.shift();
			}
		}
	}
	
	if (player.dragging.startsWith('P')) {
		// deal with taking a card from a player's area
		let ps = player.dragging.substr(1,1);
		let is = player.dragging.substr(2,1);
		
		if (cards.players[ps][is] > 0) {
			if (player.mouseover == 'D1') {
				// drag player's card to the discard area
				discards.unshift(cards.players[ps][is]);
				cards.players[ps][is] = 0;
			}
			if (player.mouseover.startsWith('P')) {
				// drag to another player's area
				let pd = player.mouseover.substr(1,1);
				let id = player.mouseover.substr(2,1);
				
				if (cards.players[pd][id] > 0) {	// Is a card there already? If so swap 
					let temp = cards.players[pd][id];
					cards.players[pd][id] = cards.players[ps][is];
					cards.players[ps][is] = temp;
				}
			}
		}
	}
	
	if (player.dragging == 'D1') {
		// deal with having to return a discarded card to a player's hand. Must be empty position
		if (discards.length > 0) {	// only valid if a card is there
			if (player.mouseover.startsWith('P')) {
				let p = player.mouseover.substr(1,1);
				let i = player.mouseover.substr(2,1);
				if (cards.players[p][i] == 0) {
					cards.players[p][i] = discards.shift();
				}
			}
			if (player.mouseover == 'D2' && cardDeck.length == 0) {
				console.log('shuffle discards');
				// time to shuffle the discarded cards
				cardDeck = shuffleDeck(discards);
				discards = [];
			}
		}
	}
	
	// update the drawarea in case it's changed
	cards.drawarea[0] = discards.length > 1 ? discards[1] : 0;
	cards.drawarea[1] = discards.length > 0 ? discards[0] : 0;
	cards.drawarea[2] = cardDeck.length > 0 ? rear : 0;

	player.dragging = "";
	player.cardID = 0;
  });
  
});

setInterval(function() {
	// either send cards as-is or make all player cards hidden.
	cardsHidden = JSON.parse(JSON.stringify(cards));	// dirty hack to take a deep copy
	if (!showAllCards) {
		for (let p=0; p<5; p++) {
			for (let c=0; c<6; c++) {
				if (cardsHidden.players[p][c] > 0) {
					cardsHidden.players[p][c] = rear;
				}
			}
		}
	}

	io.sockets.emit('cards', cardsHidden);
}, 1000 / 5);

setInterval(function() {
	// generate a 'mice' message for each connected user
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
	// https://www.w3schools.com/js/js_array_iteration.asp
	// https://stackoverflow.com/questions/11616630/how-can-i-print-a-circular-structure-in-a-json-like-format
	//Object.entries(players).forEach( (pp) => { 
	for (let [_, p] of Object.entries(players)) {
		//console.log('p: ' + util.inspect(p) );
		mice = [];
		
		// now produce an entry for each connection. 

		for (let [_, player] of Object.entries(players)) {
			// decide whether to display the dragged card or not. Options for card visibility
			// 1. a card not being dragged. player.cardID = 0, so not visible -> value = 0
			// 2. a card is being dragged. if it's a different player, always show rear card instead
			// 3. a card is being dragged & is the same player. Show rear card UNLESS hovering over the dragArea
			let cardID = player.cardID;
			if (cardID != 0) {
				if (p.id != player.id) {
					cardID = rear;
				} else {
					// it's for my own display. Only display it whilst in the dragArea
					if (p.mouseover != 'dragArea') {
						cardID = rear;
					}
				}
			}
			mice.push( {id: player.id, x: player.x, y: player.y, cardID: cardID});	
			
		};
		p.socket.emit('mice', mice);
	};
		
}, 1000 / 30);
