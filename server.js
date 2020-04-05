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

function extract(id) {
		return[ id.substr(1,1), id.substr(2,1)];
}

function extractDrag(id) {
		return[ id, id.substr(1,1), id.substr(2,1)];
}

// Campari Game Code

// Cards. 0 = no card, 1 = Ace Spades, 2 = 2 Spades, ..., 52 = King Hearts, 53 = Joker, 54 = rear of card
var cardDeck = {};		// the cards in the pick-up pile
var discards = [];		// cards that have been discarded
var cards = {};			// the cards as dealt & are displayed
let rear = 54;			// id of the image displaying the card's rear
let dragCard = 55;		// id of the image displaying 'dragging' 

var players = {};		// each client connection, keyed by the socket.id. Hard coded for 5 players currently.
var playerIDs = fillArrayWithRange(0, 5);	// allocated ids from this 'stack', and return them when the connection closes
var showAllCards = false;	// true when the game is over

var playerNames = ['not connected', 'not connected', 'not connected', 'not connected', 'not connected', ];

var snaps = [];		// list of snap times by player
var snapTimer = '';


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
	//console.log("Shuffled " + JSON.stringify(cards));
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
		mouseover: '',		// the element the mouse is currently over
		dragSource: '',		// the element the mouse was over when there was a mousedown event, starting the drag operation
		cardID: 0,			// the card to display when dragging; 0 means no card being dragged
		dragTarget: '',		// set to the element the mouse is over if it's a valid drag target.
		socket: socket,
    };
	
	socket.emit('playerID', playerID);
	
	//for (let skt in players) {	// players is keyed by socket.id
	//	console.log(`socket: ${skt}, playerID: ${players[skt].id}`);
	//}
	
  socket.on('disconnect', function(data) {
	console.log("player disconnected - id is " + socket.id);
	//if (players[socket.id] != null && players[socket.id] != undefined ) {
		console.log("deleting " + socket.id);
		playerIDs.unshift(players[socket.id].id);	// return the player id for re-use.
		playerNames[players[socket.id].id] ='disconnected';
		io.sockets.emit('names', playerNames);
		delete players[socket.id];
	//}
  });
  
  socket.on('name', function(update) {
	playerNames[update.thisPlayer] = update.playerName;
	io.sockets.emit('names', playerNames);
  });
  
  socket.on('snap', function(update) {
	//snaps 
	if (snaps.length == 0) {
		// It's the first snap, so set the timer
		snapTimerStart = Date.now();
	}
	if (snaps.length < 5 ) {	//don't allow too many and overwrite the display. Could log only 1st input from a player
		let elapsed = Date.now() - snapTimerStart;
		let player = players[socket.id];
		//console.log('Snap: player is: ' + util.inspect(player));
		let id = player.id;
		let name = playerNames[id];
		snaps.push(`${elapsed} millisecs, by ${name}`);
	}
	//console.log(util.inspect(snaps));
	io.sockets.emit('snaps', snaps);
  });
  
  socket.on('mouseover', function(data) {
	var player = players[socket.id] || {};
	player.mouseover = data;
	var valid = false;
	console.log('mouseover - mouseover: ' + player.mouseover + ' dragging: ' + player.dragSource);
	
	// See whether the this a valid drag target. If so mark it.
	[dragSource, pss, iss] = extractDrag(player.dragSource);
	[dragDest, pdd, idd]  = extractDrag(player.mouseover);
	
	if (dragSource == 'D2' && cardDeck.length > 0) {
		// taking a card from the pile - valid if there are cards on the pile
		if (dragDest == 'D1' || dragDest.startsWith('P')) {
			valid = true;
		}
	}
	
	if (dragSource.startsWith('P') && cards.players[pss][iss] > 0) {
		// taking a card from a player's area - only if there's a card there
		if (dragDest == 'D1' || dragDest.startsWith('P')) {
			// drag player's card to the discard area or to a player's area.
			valid = true;
		}
	}
	
	if (dragSource == 'D1' && discards.length > 0) {
		// taking the discard card - if there's a card there
		if (dragDest.startsWith('P')) {
			// moving a discarded card to a player's hand. 
			valid = true;
		}
		if (dragDest == 'D2' && cardDeck.length == 0) {
			// shuffle the discarded cards
			valid = true;
		}
	}

	player.dragTarget = valid ? data: '';	// only set if the drag is valid
	
  });
  
  socket.on('mousemove', function(data) {
	console.log('mousemove ' + JSON.stringify(data));
	var player = players[socket.id] || {};
	player.x = data.x;
	player.y = data.y;
	player.buttons = data.buttons;
  });

  socket.on('mousedown', function(data) {
	console.log('mousedown ' + JSON.stringify(data));
	var player = players[socket.id] || {};
	player.buttons = data.buttons;
	player.dragSource = player.mouseover;
	player.x = data.x;
	player.y = data.y;
	
	// Decide whether to display the card being dragged
	player.cardID = 0;	// assume not to start with
	
	// drag from the pile
	if (player.dragSource == 'D2' & cardDeck.length > 0) {
		// taking a card from the pile
		player.cardID = cardDeck[0];	// peek at the top card
	}
	
	if (player.dragSource == 'D1' && discards.length > 0) {
		// taking a card from discards
		player.cardID = discards[0];	// peek at the top discard
	}
	
	if (player.dragSource.startsWith('P')) {
		let ps = player.dragSource.substr(1,1);
		let is = player.dragSource.substr(2,1);
		player.cardID = cards.players[ps][is];
	}
	
	if (player.cardID == 0) {	// only drag a card has actually been selected
		player.dragSource = '';
	}
			
  });

  socket.on('mouseup', function(data) {
	  console.log('mouseup ' + JSON.stringify(data));
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
	
	if (player.mouseover == 'clearSnaps') {
		snaps = [];
		io.sockets.emit('snaps', snaps);	// yuck - I do this in several places - a smell.
	}
	
	// process drag completions
	[dragSource, pss, iss] = extractDrag(player.dragSource);
	[dragDest, pdd, idd]  = extractDrag(player.mouseover);
	
	if (dragSource == 'D2' && cardDeck.length > 0) {
		// taking a card from the pile - only do anything if there are cards on the pile
		if (dragDest == 'D1') {
			discards.unshift(cardDeck.shift());
		}
		if (dragDest.startsWith('P') ) {
			// dragging onto a player's card area.
			if (cards.players[pdd][idd] > 0) {	// Is a card there already? If so, put the existing card onto the discard pile
				discards.unshift(cards.players[pdd][idd]);
			}
			cards.players[pdd][idd] = cardDeck.shift();
		}
	}
	
	if (dragSource.startsWith('P') && cards.players[pss][iss] > 0) {
		// taking a card from a player's area - only if there's a card there
		if (dragDest == 'D1') {
			// drag player's card to the discard area
			discards.unshift(cards.players[pss][iss]);
			cards.players[pss][iss] = 0;
		}
		if (dragDest.startsWith('P')) {
			// drag to another player's area. Swap. Works if there's a card at the dest or not
			let temp = cards.players[pdd][idd];
			cards.players[pdd][idd] = cards.players[pss][iss];
			cards.players[pss][iss] = temp;
		}
	}
	
	if (dragSource == 'D1' && discards.length > 0) {
		// taking the discard card - if there's a card there
		if (dragDest.startsWith('P')) {
			// moving a discarded card to a player's hand. 
			let temp = discards.shift();
			if (cards.players[pdd][idd] != 0)		// only replace a valid card onto the discard pile
				discards.unshift(cards.players[pdd][idd]);
			cards.players[pdd][idd] = temp;
		}
		if (dragDest == 'D2' && cardDeck.length == 0) {
			// shuffle the discarded cards
			cardDeck = shuffleDeck(discards);
			discards = [];
		}
	}
	
	// update the drawarea in case it's changed
	cards.drawarea[0] = discards.length > 1 ? discards[1] : 0;
	cards.drawarea[1] = discards.length > 0 ? discards[0] : 0;
	cards.drawarea[2] = cardDeck.length > 0 ? rear : 0;

	player.dragSource = '';
	player.dragTarget = '';
	player.cardID = 0;
  });
  
});

setInterval(function() {
	// send cards - either as-is or make all player cards hidden.
	cardsHidden = JSON.parse(JSON.stringify(cards));	// dirty hack to take a deep copy
	if (!showAllCards) {
		// hide all the player cards
		for (let p=0; p<5; p++) {
			for (let c=0; c<6; c++) {
				if (cardsHidden.players[p][c] > 0) {
					cardsHidden.players[p][c] = rear;
				}
			}
		}
	}
	
	// mark any cards that are being dragged
	// player.dragTarget
	for (let [_, player] of Object.entries(players)) {
		//deal with the drag source
		[dragSource, ps, cs] = extractDrag(player.dragSource);
		if (dragSource == 'D2') cardsHidden.drawarea[2] = dragCard;
		if (dragSource == 'D1') cardsHidden.drawarea[1] = dragCard;
		if (dragSource.startsWith('P')) {
			cardsHidden.players[ps][cs] = dragCard;
		}
		// deal with the target drag dest.
		[dragTarget, pt, ct] = extractDrag(player.dragTarget);
		if (dragTarget == 'D2') cardsHidden.drawarea[2] = dragCard;
		if (dragTarget == 'D1') cardsHidden.drawarea[1] = dragCard;
		if (dragTarget.startsWith('P')) {
			cardsHidden.players[pt][ct] = dragCard;
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
	// Simplier to just do for(let sktID in players) {...}. See demo code above in io connection.
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
			mice.push( {id: player.id, x: player.x-30, y: player.y-30, cardID: cardID});	
			
		};
		p.socket.emit('mice', mice);
	};
		
}, 1000 / 30);
