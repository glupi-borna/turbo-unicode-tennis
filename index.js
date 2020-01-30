/** @type {HTMLElement} */
let main;
/** @type {HTMLElement} */
let ui;
let width = 27;
let height = 10;

/**
@typedef {{left: string, right: string, jump: string}} PlayerInput
*/

/**
@type {{[key: string]: PlayerInput}}
*/
let input = {
	p1: {
		left: "a",
		right: "d",
		jump: "w"
	},
	p2: {
		left: "ArrowLeft",
		right: "ArrowRight",
		jump: "ArrowUp"
	}
};

function pick( ...args ) {
	if ( args.length == 0 ) {
		return undefined;
	}

	let ind = Math.floor( Math.random() * args.length );

	return args[ind];
}

function clamp( val, min, max ) {
	if ( val < min ) {
		val = min;
	}

	if ( val > max ) {
		val = max
	}

	return val;
}

class GameObject {
	constructor() {
		objs.push( this );
		this.x = 0;
		this.y = 0;
		this.height = 0;
		this.background = "transparent";
		this.foreground = "white";
		this.display = " ";
		this.blockers = [];
		/** @type {Map<new () => GameObject, (other: GameObject) => void>} */
		this.collision_handlers = new Map();
	}

	move( xmove, ymove ) {
		let oldx = Math.floor( this.x );
		let oldy = Math.floor( this.y );

		const newx = clamp( Math.floor( this.x + xmove ), 0, width - 1 );
		const newy = clamp( Math.floor( this.y + ymove ), 0, height - 1 );

		if ( grid[newy][newx].objs.some( obj => {

			for ( const blocker of this.blockers ) {
				if ( obj instanceof blocker ) {
					if ( this.collision_handlers.has( blocker ) ) {
						this.collision_handlers.get( blocker )( obj );
					}

					return true;
				}
			}

			return false;
		} ) ) {
			return false;
		}

		this.x = clamp( this.x + xmove, 0, width - 1 );
		this.y = clamp( this.y + ymove, 0, height - 1 );

		if ( oldx == Math.floor( this.x ) && oldy == Math.floor( this.y ) ) {
			return true;
		}

		let ind = grid[oldy][oldx].objs.indexOf( this );
		grid[oldy][oldx].objs.splice( ind, 1 );


		const gridx = Math.floor( this.x );
		const gridy = Math.floor( this.y );

		grid[gridy][gridx].objs.push( this );

		for ( const obj of grid[gridy][gridx].objs ) {
			if ( obj === this ) {
				continue;
			}

			if ( obj.collision_handlers.has( this.__proto__.constructor ) ) {
				const col_func = obj.collision_handlers.get( this.__proto__.constructor );
				col_func( this );
			}
		}

		render_cell( gridx, gridy );
		render_cell( oldx, oldy );

		return true;
	}

	destroy( rerender = true ) {
		this.ondestroy();

		let ind = objs.indexOf( this );
		objs.splice( ind, 1 );

		if ( grid[this.y] && grid[this.y][this.x] ) {
			ind = grid[this.y][this.x].objs.indexOf( this );

			if ( ind !== -1 ) {
				grid[this.y][this.x].objs.splice( ind, 1 );

				if ( rerender ) {
					render_cell( this.x, this.y );
				}
			}
		}
	}

	ondestroy = () => { };

	insert() {
		grid[this.y][this.x].objs.push( this );
		render_cell( this.x, this.y );
	}
}

class Wall extends GameObject {
	constructor() {
		super();

		this.foreground = "skyblue";
		this.display = pick( ...Wall.displays() );
	}

	static displays() {
		return ["▒", "░", "▓"];
	}
}

class Ball extends GameObject {
	constructor() {
		super();

		this.background = "transparent";
		this.foreground = "orange";
		this.display = "⊜";
		this.height = 2;
		this.hspd_avg = 0.9;
		this.hspd = pick( -this.hspd_avg, this.hspd_avg );
		this.vspd = 0;

		this.blockers = [Wall, Player];

		this.collision_handlers.set( Player, ( other ) => {
			if ( other.x > width / 2 ) {
				this.hspd = -pick( this.hspd_avg, this.hspd_avg - 0.1, this.hspd_avg + 0.1 );
			} else {
				this.hspd = pick( this.hspd_avg, this.hspd_avg - 0.1, this.hspd_avg + 0.1 );
			}

			this.vspd = -1;
		} );

		this.collision_handlers.set( Wall, ( other ) => {
			if ( Math.floor( other.x ) != Math.floor( this.x ) ) {
				this.hspd = -this.hspd;
			}

			if ( Math.floor( other.y ) != Math.floor( this.y ) ) {
				this.vspd = -this.vspd * 0.5;
			}
		} );

		this.updateInterval = setInterval( () => {
			this.update()
		}, 66 );
	}

	update() {
		this.vspd = clamp( this.vspd + 0.1 /* gravity */, -10, 1 );
		this.move( this.hspd, 0 );
		this.move( 0, this.vspd );
	}

	ondestroy = () => {
		clearInterval( this.updateInterval );
	}
}

class Player extends GameObject {
	constructor( input, color ) {
		super();

		this.foreground = color;
		this.background = "transparent";
		this.display = "웃";
		this.height = 1;
		this.blockers = [Wall];
		this.score = 0;
		this.left = false;
		this.right = false;
		this.vspd = 0;
		this.grounded = false;

		window.addEventListener( "keydown", ev => {
			switch ( ev.key ) {
				case input.right:
					this.right = true;
					break;
				case input.left:
					this.left = true;
					break;
				case input.jump:
					if ( this.grounded ) {
						this.vspd = -1;
					}
					break;
			}
		} );

		window.addEventListener( "keyup", ev => {
			switch ( ev.key ) {
				case input.right:
					this.right = false;
					break;
				case input.left:
					this.left = false;
					break;
				case input.jump:
					if ( this.vspd < 0 ) {
						this.vspd *= 0.5;
					}
					break;
			}
		} );

		this.updateInterval = setInterval( () => {
			this.update();
		}, 33 );
	}

	update() {
		const hor_move = +this.right - +this.left;
		this.vspd = clamp( this.vspd + 0.1 /* gravity */, -10, 1 );
		this.grounded = !this.move( 0, this.vspd );
		this.move( hor_move * 0.5, 0 );
	}


	ondestroy = () => {
		clearInterval( this.updateInterval );
	}
}

/** @type {{el: HTMLElement, objs: GameObject[]}[][]} */
let grid;
/** @type {GameObject[]} */
let objs = [];

window.onresize = () => {
	let ratio = width / height;

	if ( width > height ) {
		main.style.width = "100%";
		let wid = main.getBoundingClientRect().width;
		main.style.height = wid * ( 1 / ratio ) + "px";
	} else {
		main.style.height = "100%";
		let hei = main.getBoundingClientRect().height;
		main.style.width = hei * ( ratio ) + "px";
	}


	let rect = main.getBoundingClientRect();

	main.style.fontSize = ( rect.height / height ) + "px";
	main.style.lineHeight = main.style.fontSize;
};

window.onload = () => {
	main = document.querySelector( "main" );
	ui = document.querySelector( "ui" );

	window.onresize();

	setup_grid();
	setup_menu();
	render_grid();
};

window.onkeyup = ( ev ) => {
	if ( ev.key == "Escape" ) {
		clear_grid();
		ui_clear();
		setup_menu();
	}
}

function setup_grid() {
	grid = [];
	for ( let y = 0; y < height; y++ ) {
		const row = document.createElement( "div" );
		const gridrow = [];
		row.className = "row";
		grid.push( gridrow );

		for ( let x = 0; x < width; x++ ) {
			const cell = document.createElement( "div" );
			cell.className = "cell";
			row.appendChild( cell );
			gridrow.push( { el: cell, objs: [] } )
		}
		main.appendChild( row );
	}
}

function setup_menu() {
	ui_label( "TURBO", "35%", "15%", "black", "white", "2.5vw mono" );
	ui_label( "ｕｎｉｃｏｄｅ", "50%", "15%", "black", "fuchsia", "3vw mono" );
	ui_label( "TENNIS", "65%", "15%", "black", "white", "2.5vw mono" );

	ui_label( "p1: wasd", "25%", "66%", "white", "red", "2.5vw mono" );
	ui_label( "p2: arrows", "75%", "66%", "white", "darkblue", "2.5vw mono" );

	ui_button( "Play", "50%", "50%", () => {
		ui_clear();
		setup_game();
	}, "black", "white", "2.5vw mono" );
}

function setup_game() {
	for ( let y = 0; y < height; y++ ) {
		for ( let x = 0; x < width; x++ ) {
			if ( y == height - 1 ) {
				const wall = new Wall();
				wall.x = x;
				wall.y = y;
				wall.insert();
				wall.foreground = "green";
				wall.background = "darkgreen";
			} else if ( x == Math.floor( width / 2 ) && y > height * 0.75 ) {
				const wall = new Wall();
				wall.x = x;
				wall.y = y;
				wall.insert();
				wall.background = "white";
				wall.foreground = "gray";
				wall.display = "▩";
			}
		}
	}

	create_player( width * 0.25, "red", input.p1 );
	create_player( width * 0.75, "darkblue", input.p2 );
	const b = new Ball();
	b.x = Math.floor( width / 2 );
	b.y = Math.floor( height / 2 );
	b.insert();

	render_grid();
}

function clear_grid() {
	for ( let row of grid ) {
		for ( let cell of row ) {
			cell.el.style.background = "transparent";
			cell.el.style.color = "transparent";
			cell.el.innerText = "";

			for ( let obj of cell.objs ) {
				obj.destroy();
			}

			cell.objs = [];
		}
	}
}

function create_player( x, color, input ) {
	const p = new Player( input, color );
	p.x = Math.floor( x );
	p.y = Math.floor( height / 2 );
	p.insert();
	return p;
}

function ui_clear() {
	for ( let i = ui.children.length - 1; i >= 0; i-- ) {
		let child = ui.children[i];
		if ( child ) {
			child.remove();
		}
	}
}

function ui_button( label, x, y, onclick, bgcol = "black", fgcol = "white", font = "" ) {
	const button = document.createElement( "button" );
	button.onclick = onclick;
	button.style.color = fgcol;
	button.style.background = bgcol;
	button.style.position = "absolute";
	button.style.left = x;
	button.style.top = y;
	button.style.font = font;
	button.style.transform = "translate(-50%, -50%)";
	button.appendChild( document.createTextNode( label ) );
	ui.appendChild( button );
}

function ui_label( label, x, y, bgcol = "black", fgcol = "white", font = "" ) {
	const div = document.createElement( "div" );
	div.style.color = fgcol;
	div.style.background = bgcol;
	div.style.position = "absolute";
	div.style.left = x;
	div.style.top = y;
	div.style.font = font;
	div.style.transform = "translate(-50%, -50%)";
	div.appendChild( document.createTextNode( label ) );
	ui.appendChild( div );
}

function render_cell( x, y ) {
	const cell = grid[y][x];
	const sortedobjs = cell.objs.sort( ( a, b ) => b.height - a.height );
	const el = cell.el;

	obj = sortedobjs[0];

	if ( obj ) {
		el.innerText = obj.display;
		el.style.color = obj.foreground;
		let bkg = "transparent";
		let ind = 1;

		while ( bkg == "transparent" && obj ) {
			bkg = obj.background;
			obj = sortedobjs[ind];
			ind++;
		}

		el.style.backgroundColor = bkg;

	} else {
		el.innerText = " ";
		el.style.backgroundColor = "transparent";
		el.style.color = "transparent";
	}
}

function render_grid() {
	for ( let y = 0; y < height; y++ ) {
		for ( let x = 0; x < width; x++ ) {
			render_cell( x, y );
		}
	}
}