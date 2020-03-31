//let {h, render, Component} = preact;

// From http://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-an-array-based-on-suppl
function range(start, count) {
  return Array.apply(0, Array(count))
	.map(function (element, index) { 
	  return index + start;  
  });
}

var socket = io();


var thisPlayer = -1;		// the server will initialise this
var playerName = '';

socket.on('playerID', function(data) {
  console.log(`PlayerID: ${data}`);
  thisPlayer = data;
  playerName = 'Player ' + data;
  socket.emit('name', {thisPlayer, playerName});
  playerName = 'enter your name';
});

class CursorPlay extends Component {
	constructor() {
		super();
		this.state = {
			players: {}
		};
		
		socket.on('state', (players) => {
			this.setState( {players: players} );
		});
	}
	
	render(props, state) {
		return	h(Canvas, {players: this.state.players}, props);
	}
}

// Campari Card Game code starts here:

// Todos:
// Tidy "shuffle" display, UI
// * centre "My Cards"
// properly centre the drawArea
// * prevent highlighting text, elements when dragging
// prevent scroll bars appearing
// offset second discard slightly to make look more like a pile
// some elements have 'disabled' which is invalid
// Allow variable no. of players - not really needed


// Done:
// Allow name entry. Change 'div' to input for my display. Wire entry to sending messages to server. Server sends updated names whenever. names held in preact state.
// - how stop server updates overwriting name being typed? Include names in 'cards' message? Maybe initially generate local name from playerID, & never update it remotely. 
// - Server just broadcasts any name message it receives (name message would include playerID).
// colored border when dragging card - know who's dragging
// Improve hand icon - make bigger & more background color
// Somehow identify which player you are.
// have 3 players top, 2 bottom. Your position determined at connection.
// When dragging show which card is being dragged. Sigh.
// * specific value for "no-card"
// * add display mouse drag for all players - icon could be hand https://unicode-table.com/en/270B/ U+270B or an arrow (https://unicode-table.com/en/search/?q=arrow). eg https://unicode-table.com/en/2B66/
// Implement all game logic
// Game start:
// (done) - click shuffle to fully initialise the board: shuffle the cards and deal them to all players. (but not start the discard pile). 
// (done) - drag from pile to display (on game start)
// My turn:
// (done) - drag from pile to show area to view card
// (done) - drag from pile to discard pile (any existing card moves to left)
// (done) - drag from pile to own hand. Card dragged onto moves to discard pile
// On emptying the pile:
// (done) - drag from discard to empty pile causes discards to be picked up, shuffled and returned to the pile. Not automatic since need to see what the latest discard was.
// Implement special cards:
// (done) - drag one of my cards to show area
// (done) - drag one of opponent's cards to show area
// (done) - drag one of my cards onto an opponent's card, causing them to swap positions
// When calling snap:
// (done) - drag one of my cards to discard (any existing card in discard area moves to left). If non-match: drag card back to my hand, and drag new card from pile to hand
// (done) - drag an opponent's card to discard (any existing card in discard area moves to left). If non-match: drag card back to opponent's hand, and drag new card from pile to hand
// Call cambio:
// - no action
// Game completion:
// - click "show all" button to display all players cards
// Game completion:
// - click "show all" button to display all players cards


function mapCardToName(card) {
	let name = "";
	if (card == 54) {			// rear of card
		name = 'b';
	} else if (card == 55) {	// card being dragged
		name ='bd';
	} else if (card == 53) {	// joker
		name = 'j';
	}else {
		card--;
		let no = card % 13;
		let suit = Math.floor(card / 13);
		name = ['a', '2', '3', '4', '5', '6', '7', '8', '9', 't', 'j', 'q', 'k'][no] + ['s', 'c', 'd', 'h'][suit];
	}
	if (card == 26) {
		//	console.log("Card 26");
		name = 'add';	// something very strange with accessing ad.gif - server error. Dirty temp hack
	}
	return name;
}

class Card extends Component {
	
	render(props, state) {
		let card = props.card;
		if (card == 0)
			return h('div', {className: 'nocard', id: props.id});
		
		let name = mapCardToName(card);
		return h('div', {className: 'card Player' + props.playerID}, 
			h('img', {src: "/static/cardimages/" + name + ".gif", 
						id: props.id,
						//className: 'card', 
						onmousedown: e => e.preventDefault(),	// stop the image being dragged
						// use mouseover, mouseout (and id) instead... onmouseover: e => console.log("over card: " + name),	// can report when mouse is over a card
						})
			);	
	}
}

class Player extends Component {
	
	render(props, state) {
		let renderingThisPlayer = props.playerID == thisPlayer;
		let bolded = (renderingThisPlayer) ? ' bolded' : '';
		return h('div', {className: 'player Player' + props.playerID + bolded}, 
			(renderingThisPlayer 
				? h('input', {className: 'entry', value: playerName,
						oninput: e => {	// such a dirty hack! Should ideally keep the name as a state & pass upward, but hey!
							playerName = e.srcElement.value; 
							socket.emit('name', {thisPlayer, playerName})
						},
						onfocus: e => {	e.srcElement.select() }	// highlight all the text when clicking on the input box
				})
				: h('div', null, props.name)), 
			range(0,2).map( (r) => h('div', {className: 'player-row'}, 
				range(0, 3).map( (c) => (h(Card, {card: props.cards[r*3 + c], playerID: props.playerID, id: "P" + props.playerID + (r*3 + c) })))	// {type: "player", player: props.playerID, card: (r*3 + c)} 
				)
			)
		);
	}
}

class DrawArea extends Component {
	
	// http://jsfiddle.net/wUrdM/ relative positioning
	// https://stackoverflow.com/questions/11143273/position-div-relative-to-another-div
	render(props, state) {
		return h('center', {className: "drawArea"}, 
			h('div', {position: 'relative'}, 
				h(Card, {card: props.cards[0],  id: 'D0'}),
				h('div', {position: 'absolute', top: '10px', left: '30px'}, 
					h(Card, {card: props.cards[1], id: 'D1'})
				)
			),
			h(Card, {card: props.cards[2], id: 'D2'}),
			h('button', {id: 'shuffle'}, "Shuffle"),
			h('button', {id: 'showCards'}, "Show Cards"),
			h('div', null, '10: peek at own card'),
			h('div', null, 'J: peek at anothers card'),
			h('div', null, 'Q: swap own card with another'),
			h('div', null, 'Red K: 0 points'),
			)
	}
}

class DragArea extends Component {
	
	render(props, state) {
		return h('div', {className: 'dragArea', id: "dragArea" /*, onmouseover: e => console.log("entered drag area")*/}, 'drag a card to this area to view it')
	}
}

class DraggedCards extends Component {
	// to render a div at an arbitrary location: http://jsfiddle.net/f5EMT/1/, https://stackoverflow.com/questions/24050738/javascript-how-to-dynamically-move-div-by-clicking-and-dragging
	//http://jsfiddle.net/f5EMT/1/ mouse draggable element // https://blog.bitsrc.io/5-ways-to-style-react-components-in-2019-30f1ccc2b5b
	
	render (props, state) {
		// - for own mouse, just render the dragged card (if any). Rely on browser to display curror.
		// - for others mouse - render the dragged card (if any), otherwise display their cursor

		return 	h('div', null,
				props.mice.map( mouse => (
					(mouse.cardID == 0) 
					? h('div', {className: 'draggable icon Player'+mouse.id,
						style: {left: mouse.x, top: mouse.y, visibility: (mouse.id == thisPlayer ? 'hidden' : 'visible')},
						}, '\u270B')	// hand icon
					: h('img', {src: "/static/cardimages/" + mapCardToName(mouse.cardID) + ".gif", 
						className: 'card draggable Player' + mouse.id, 
						style: {left: mouse.x, top: mouse.y, visibility: (mouse.cardID > 0 ? 'visible' : 'hidden')},
						onmousedown: (e => e.preventDefault()),	// stop the image being highlighted when dragged
						})
					)
				)
		)
	}
}

// messages server -> client:
// * playerID - the id allocated to this player
// * cards - list of all cards in set locations. Sent only when there's a card change, so infrequent
//   an array of 5 for all players (each being an array of 5), plus an array for the cards in the draw area
// * mice - one struct per player. Sent very frequently to track all players mouse movements
//   Each struct contains 
//   * playerid
//   * mouse coordinates
//   * card-id it's dragging, or 0 if none. Obviously only display a card if it's present

// messages client -> server
// * mousemove - mouse coords, and button state. Sent 20 (?) times per sec. So very fast. Needs to be fast for the display to be responsive
// * mouseover - id of the element the mouse has just moved into, or "" when the element has no id. Only sent when necessary, so infrequent
// * mousedown - mouse coords, and button state. Sent only when necessary, so infrequent
// * mouseup   - mouse coords, and button state. Sent only when necessary, so infrequent

class Cambio extends Component {
	constructor() {
		super();
		// horrible to initialise like this. Must be a better way to avoid null errors etc.
		// set up all the cards. Must be simpler when all the same
		let cards = {};
		let card = 0;
		cards.players = [];
		for (let p=0; p<5; p++) {
			cards.players[p] = [];
			for (let c=0; c<6; c++) {
				cards.players[p][c] = card;
			}
		}
		cards.drawarea = [0, 0, 0];
		this.state = {
			cards: cards,
			mice: [],
			//mouse: {x: 0, y: 0, buttons: 0},	// temp
			names: ['', '', '', '', '',],
		};
		
		// mouse tracking
		this.mouse = {x: 0, y:0, buttons: 0};
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp   = this.onMouseUp.bind(this);
		this.onMouseOut = this.onMouseOut.bind(this);
		setInterval( () => {
			this.setState({mouse: this.mouse});
			socket.emit("mousemove", this.mouse);
			}, 1000 / 20);
		
		// messages from the server
		socket.on('cards', (cards) => {
			this.setState( {cards: cards, mice: this.state.mice, names: this.state.names} );
		});
		
		socket.on('mice', (mice) => {
			this.setState( {cards: this.state.cards, mice: mice, names: this.state.names} );
		});
		
		socket.on('names', (update) => {	// update all new names as they arrive
			console.log(JSON.stringify(update));
			this.setState( {cards: this.state.cards, mice: this.state.mice, names: update} );
		});
	}
	
	// https://www.w3schools.com/jsref/obj_mouseevent.asp
	// https://www.w3schools.com/jsref/dom_obj_event.asp the different events available
	onMouseMove(e) {	
		this.mouse.x = e.clientX;
		this.mouse.y = e.clientY;
		this.mouse.buttons = e.buttons;
	};
	
	onMouseDown(e) {
		this.mouse.x = e.clientX;
		this.mouse.y = e.clientY;
		this.mouse.buttons = e.buttons;	
		socket.emit('mousedown', this.mouse);	// report this immediately as an event
	}
	
	onMouseUp(e) {
		this.mouse.x = e.clientX;
		this.mouse.y = e.clientY;
		this.mouse.buttons = e.buttons;	
		socket.emit('mouseup', this.mouse);		// report this immediately as an event
	}
		
	onMouseOut(e) {
		let z = e.relatedTarget;
		if (z != null) {
			console.log("OnmouseOut - related target is "+ z.id);	// this gives the newly entered item.
			socket.emit('mouseover', z.id);
		}
	}

	render(props, state) {
	
		return h('div', { //className: "campari", 
						onmousemove: e => this.onMouseMove(e), 
						onmousedown: e=>this.onMouseDown(e), 
						onmouseup: e=>this.onMouseUp(e), 
						onmouseout: e => this.onMouseOut(e)}, 
			h('div', {className: 'opponents'}, 
				range(0, 3).map( (c) => h(Player, {name: state.names[c], index: c, playerID: c, cards: state.cards.players[c]}))),
			h(DrawArea, {cards: state.cards.drawarea}),
			h('div', {className: 'opponents'}, 
				range(3, 2).map( (c) => h(Player, {name: state.names[c], index: c, playerID: c, cards: state.cards.players[c]}))),
			h(DragArea),
			h('div', {className: 'bottomMargin'}),	// need this to allow drag to the DragArea from below
			h(DraggedCards, {mice: this.state.mice}),


		);
	}		
}

class App extends Component {
	
	render(props, state) {
		return	h("div", {className: "campari",}, 
			h('h1', null, 'Campari'),
			h(Cambio),
		);
	}
}

render(h(App), document.body);


