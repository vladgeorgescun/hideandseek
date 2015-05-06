/**
 * Client implementation
 * @fileName client.js
 * @creationDate jan 2013
 * @author vladgeorgescun
 **/

var FRAME_TIME = 60/1000;
if('undefined' != typeof(global))
    FRAME_TIME = 45;

(
    function ()
    {
        var lastTime    = 0;
        var vendors     = [ 'ms', 'moz', 'webkit', 'o' ];

        for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x )
        {
            window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
            window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
        }

        if ( !window.requestAnimationFrame )
        {
            window.requestAnimationFrame =
                function ( callback, element )
                {
                    var currTime = Date.now(), timeToCall = Math.max( 0, FRAME_TIME - ( currTime - lastTime ) );
                    var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
                    lastTime = currTime + timeToCall;
                    return id;
                };
        }

        if ( !window.cancelAnimationFrame )
        {
            window.cancelAnimationFrame =
                function ( id )
                {
                    clearTimeout( id );
                };
        }

    }() );

var
    game = {},
    client = {},
    gameResources = new GameResources(),
    gameDefines = new GameDefines(),
    gameUtils = new GameUtils();

// onload function
window.onload =
    function()
    {
        try
        {

            // instantiate the game
            game = new GameCore();

            // create the client on the socket io - the io is created automatically when connecting to the server
            client = new GameClient(game, io);

            //Fetch the canvas
            client.canvas.background = document.getElementById("game_canvas_background");
            client.canvas.players = document.getElementById("game_canvas_players");

            //Fetch the rendering contexts
            client.gContext.background = client.canvas.background.getContext("2d");
            client.gContext.players = client.canvas.players.getContext("2d");

            // init the keyboard
            client.keyboard       = new THREEx.KeyboardState();

            // connects to the server and initializes the server message handler
            client.connectToServer();
            client.start();

            client.showScreen("game_pick");
        }
        catch (ex)
        {
            alert(ex);
        }
    };

/*
 * on unload event
 */
window.onunload =
    function()
    {
        client.onExit();
    };

/**
 * event before unload (exit confirmation)
 */
$(window).bind("beforeunload",
    function(event)
    {
        var returnValue = Lang.gettext("Do you really want quit Hide and Seek?");
        event.returnValue = returnValue;

        return returnValue;
    });

/**
 * gets the mouse coordinates on a canvas
 * @param event - the canvas
 * @return {Object} - the mouse coordinates
 */
HTMLCanvasElement.prototype.relMouseCoords =
    function (event)
    {
        var totalOffsetX = 0;
        var totalOffsetY = 0;
        var canvasX = 0;
        var canvasY = 0;
        var currentElement = this;

        do
        {
            totalOffsetX += currentElement.offsetLeft;
            totalOffsetY += currentElement.offsetTop;
        }
        while (currentElement = currentElement.offsetParent);

        canvasX = event.pageX - totalOffsetX;
        canvasY = event.pageY - totalOffsetY;

        // Fix for variable canvas width
        canvasX = Math.round( canvasX * (this.width / this.offsetWidth) );
        canvasY = Math.round( canvasY * (this.height / this.offsetHeight) );

        return {x:canvasX, y:canvasY}
    };

/**
 * game client class constructor
 * @param gameInstance - instance of the game core
 * @param socket - the client io socket
 * @constructor - game client constructor
 */

var GameClient =
    function (gameInstance, socket)
    {
        // network variables
        this.gameInstance           = gameInstance; // game instance
        this.gContext               = {background: {}, objectsFixed:{}, objectsInteractive:{}, players:{}}; // graphical context
        this.canvas                 = {background: {}, objectsFixed:{}, objectsInteractive:{}, players:{}}; // game canvas
        this.ioSocket               = socket;
        this.ioConnection           = {}; // the server connection
        this.state                  = gameDefines.PLAYER_STATE_DISCONNECTED; // client state
        this.event                  = gameDefines.PLAYER_EVENT_NONE; // player event

        // physics variables
        this.inputs                 = []; // client inputs
        this.inputSequence          = 0; // current input sequence
        this.lastInputSequence      = 0; // last input sequence treated by the server
        this.position               = {x:0, y:0}; // player position
        this.lastState              = {position:{x:0, y:0}};// last position state
        this.currentState           = {position:{x:0, y:0}};// current position state
        this.shadowPosition         = {position:{x:0, y:0}};// shadow position of self on server
        this.drawingOffset          = {positionTopLeft:{x:0,y:0}, positionBottomRight:{x:gameDefines.CANVAS_WIDTH,y:gameDefines.CANVAS_HEIGHT}}; // drawing offset used for map scrolling
        this.interpTimeFrame        = 1;
        this.pingTime               = new Date();
        this.pingValue              = 1; // ping value in ms
        this.dx                     = gameDefines.TILE_WIDTH / 2; // client width
        this.dy                     = gameDefines.TILE_HEIGHT / 2; // client height
        this.lastDrawingDirection   = "r"; // last drawing direction to draw the correct sprite
        this.selectedPath           = []; // mouse path
        this.selectedPathInputs     = []; // inputs from the mouse path
        this.selectedPathDeltaTime  = 0.016;

        // game play variables
        this.clientId               = "";
        this.name                   = "Unknown"; // player name
        this.type                   = gameDefines.PLAYER_HIDER; // player type
        this.score                  = {typeScore:0, timesCaught:0, overallScore:0}; // player score - typeScore based on the player type (gold gathered/hiders caught), and overall the game score
        this.speed                  = gameDefines.PLAYER_SPEED;
        this.timer                  = {trap:0, cdTrap: 0, speed:0, vision:0, jail:0, cdSpeed:0, speedBurst:0}; // player timers
        this.noTraps                = gameDefines.NO_TRAPS;

        this.enableSounds           = false;
        this.isHuman                = true;
    };

/**
 * log function
 * @param msg - the message to be logged
 */
GameClient.prototype.log =
    function(msg)
    {
        $("#logMessages").append($('<text/><br/>').text(new Date().getTime() + " " + (msg)));
    };

/**
 * log function
 * @param msg - the message to be logged
 */
GameClient.prototype.logOnce =
    function(msg)
    {
        document.getElementById("logOnceMessages").innerHTML = new Date().getTime() + " " + msg;
    };

/**
 * called when the client has completely disconnected from the game
 */
GameClient.prototype.onExit =
    function()
    {
        // tell the server i am disconnecting
        var server_packet =
        {
            clientId: this.clientId
        };
        this.ioConnection.emit("disconnectMessage");
        this.ioConnection.emit("disconnect");
        this.ioConnection.disconnect();
    };

/**
 * clicking on the sound image
 */
GameClient.prototype.onSound =
    function()
    {
        this.enableSounds = !this.enableSounds;

        if (this.enableSounds)
            document.getElementById("img_speaker").src = "./res/icons/speaker_on.png";
        else
            document.getElementById("img_speaker").src = "./res/icons/speaker_off.png";
    };

/**
 * send a chat message button
 * @param event - the associated key event
 */
GameClient.prototype.onSendLobbyChat =
	function(event)
	{
        var chat_mode = -1;
        var message = "";

        switch (this.state)
        {
            case gameDefines.PLAYER_STATE_PENDING: // lobby states
            case gameDefines.PLAYER_STATE_READY:
            case gameDefines.PLAYER_STATE_INGAME: // in game states
            case gameDefines.PLAYER_STATE_JAILED:
                message = (document.getElementById("input_Chat").value).trim();
                if (document.getElementById("combobox_ChatMode").selectedIndex == 1) // team selection
                    chat_mode = this.type;
                break;
        }

		if (event == 13 && message.length > 0) // enter pressed and at least on character sent
		{
			// send the server message
			var server_packet =
			{
				header: gameDefines.MESSAGE_CLIENT_CHAT,
				gameId: this.gameInstance.gameId,
				playerName: this.name,
				chatMode: chat_mode,
				chatMessage: message
			};

			this.ioConnection.emit("message", server_packet);
			document.getElementById("input_Chat").focus();
		}
	};
/**
 * on join a game button
 */
GameClient.prototype.onButJoinGame =
    function()
    {
        if (document.getElementById("input_Name").value == "")
        {
            document.getElementById("input_Name").focus();
            document.getElementById("text_invalidName").style.display = "inline";
            return;
        }
        document.getElementById("text_invalidName").style.display = "none";

        document.getElementById("but_JoinGame").setAttribute("disabled", "true");
        document.getElementById("but_JoinGame").innerHTML = Lang.gettext("Looking for a game ...");

        this.name = document.getElementById("input_Name").value;

        // send a message to the server requesting to join a game with the client picked type
        var server_packet =
        {
            header: gameDefines.MESSAGE_CLIENT_JOINGAME,
            name: this.name
        };

        this.ioConnection.emit("message", server_packet);

        if (this.enableSounds)
            gameResources.playSound(gameResources.SOUND_CLICK);
    };

/**
 * on change team click
 * @team - the selected team
 */
GameClient.prototype.onChangeTeam =
    function(team)
    {
        try
        {
            var type = 0;
            // send the server a type change request
            if (team == 0)
                type = gameDefines.PLAYER_HIDER;
            else
                type = gameDefines.PLAYER_SEEKER;

            // send a message to the server asking a type change
            var server_packet =
            {
                header: gameDefines.MESSAGE_CLIENT_CHANGETEAM,
                clientId: this.clientId,
                type: type
            };
            this.ioConnection.emit("message", server_packet);

            if (this.enableSounds)
                gameResources.playSound(gameResources.SOUND_CLICK);
        }
        catch (err)
        {
            this.logOnce(err);
        }
    };

/**
 * on ready button
 */
GameClient.prototype.onButReady =
    function()
    {
        if (this.enableSounds)
            gameResources.playSound(gameResources.SOUND_CLICK);

        // test that at least one hider and on seeker are in the game
        var found_seekers = false;
        var found_hiders = false;

        for (var p = 0; p < this.gameInstance.players.length; p++ )
            if (this.gameInstance.players[p].type == gameDefines.PLAYER_HIDER)
                found_hiders = true;
            else
                found_seekers = true;

        // at least one seeker and one hider is required to start the game
        if ((!gameDefines.DEBUG_MODE && (!found_seekers || !found_hiders)) && false)// TODO:remove this
        {
            document.getElementById("label_StartGame").setAttribute("color", "#FF0000");
            document.getElementById("label_StartGame").innerHTML = Lang.gettext("At least on seeker and one hider are required to start the game!");
            document.getElementById("label_StartGame").style.display = "block";
            return;
        }

        // send a message to the server telling him he is ready
        var server_packet =
        {
            header: gameDefines.MESSAGE_CLIENT_STARTGAME,
            clientId: this.clientId
        };
        this.ioConnection.emit("message", server_packet);

        document.getElementById("label_StartGame").setAttribute("color", "#FFFFFF");
        document.getElementById("label_StartGame").innerHTML = Lang.gettext("Waiting for the other players ...");
        document.getElementById("label_StartGame").style.display = "block";
        document.getElementById("but_StartGame").setAttribute("disabled", "true");
        document.getElementById("but_StartGame").innerHTML = Lang.gettext("Please wait ...");

        // update the gui information elements
        this.initIconsByPlayerType();
    };

/**
 * back to main menu from the score screen
 */
GameClient.prototype.onButBackToMain =
    function()
    {
        this.showScreen("game_pick");
    };

/**
 * mouse click event on the canvas for moving
 * @param event
 */
GameClient.prototype.onGameBoardMouseClick =
    function (event)
    {
        try
        {
            switch (this.state)
            {
                case gameDefines.PLAYER_STATE_INGAME: // only if in game
                    var coords = this.canvas.background.relMouseCoords(event);
                    coords.x += this.drawingOffset.positionTopLeft.x;
                    coords.y += this.drawingOffset.positionTopLeft.y;
                    var clicked_tile = this.gameInstance.getTileByPosition(coords);
                    // get the path from the player current position to the clicked tile

                    document.getElementById("game_board").style.cursor = "url(/res/cursors/cursor_point_goto.png), default";
                    setTimeout( function()
                    {
                        document.getElementById("game_board").style.cursor = "url(/res/cursors/cursor_point.png), default";
                    }, 250);

                    clicked_tile = this.getClosestValidMovementTile(clicked_tile); // get the closest valid movement tile


                    // compute paths for all tiles corresponding to the player corners - take the longest one to ensure non blocks of player corners
                    var selected_path = new Array();
                    var player_tiles = this.gameInstance.getPlayerTiles(this);
                    for (var i = 0; i < player_tiles.length; i++)
                    {
                        this.pathLength = this.gameInstance.world.tHeight * this.gameInstance.world.tWidth;
                        this.selectedPath = new Array();
                        this.computePath(player_tiles[i], clicked_tile, "c", new Array(), new Array());

                        if (selected_path.length < this.selectedPath.length) // get the longest path to ensure non blocks of player corners
                            selected_path = this.selectedPath.slice(0);
                    }
                    this.selectedPath = selected_path.slice(0);

                    this.rebuildPath();
                    /**/
                    break;
                case gameDefines.PLAYER_STATE_JAILED:
                    break;
            }
        }
        catch (clickEx)
        {
            this.logOnce("GameClient.prototype.onGameBoardMouseClick " + clickEx);
        }
    };

/**
 * starts the client in the current game
 */
GameClient.prototype.start =
    function()
    {
        // create the physics simulation loop
        this.clientCreatePhysicsSimulation();

        // create the ping
        this.clientCreatePing();

        // start the client update
        this.clientUpdate( new Date().getTime() );
    };

/**
 * connects to the server and initializes the socket io listeners
 */
GameClient.prototype.connectToServer =
    function()
    {
        //connect to the server
        this.ioConnection = this.ioSocket.connect();

        //On message from the server, we parse the commands and send it to the handlers
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_CONNECT, this.clientOnConnect.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_JOINGAME, this.clientOnJoinGame.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_STARTGAME, this.clientOnStartGame.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_CHAT, this.clientOnChat.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_DISCONNECT, this.clientOnDisconnect.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_UPDATE, this.clientOnServerUpdate.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_GAMEOVER, this.clientOnGameOver.bind(this));
        this.ioConnection.on(gameDefines.MESSAGE_SERVER_PING, this.clientOnPing.bind(this));

    };

// game client network functions

/**
 * on client connect
 */
GameClient.prototype.clientOnConnect =
    function()
    {
        this.state = gameDefines.PLAYER_STATE_CONNECTED;

        // start the client
        this.start();
    };

/**
 * on client ping
 */
GameClient.prototype.clientOnPing =
    function(data)
    {
        this.pingValue =  (new Date().getTime() - this.pingTime.getTime()).fixed();
        document.getElementById("srvPing").innerHTML = this.pingValue;

        // update the server info
        document.getElementById("text_onlinePlayers").innerHTML = data.connectedClients;
        document.getElementById("text_runningGames").innerHTML = data.runningGames;
    };

/**
 * on client joins a game (in lobby)
 * @param data - the data
 */
GameClient.prototype.clientOnJoinGame =
	function(data)
	{

		if (data.gameId == null) // no available games to join
		{
			alert(Lang.gettext("There are no available games at the moment! Please try again later"));
			return;
		}

		this.clientId = data.clientId;
		this.gameInstance.gameId = data.gameId;
		this.gameInstance.state = gameDefines.GAME_STATE_CREATED;

		// update the lobby info
		this.showScreen("game_lobby");

		// send a chat welcome message to all
		var message = this.name + " " + Lang.gettext("has joined the game") + "!";
		var server_packet =
		{
			header: gameDefines.MESSAGE_CLIENT_CHAT,
			gameId: this.gameInstance.gameId,
			playerName: "",
			chatMode: -1,
			chatMessage: message
		};
		this.ioConnection.emit("message", server_packet);
    };

/**
 * on client starts the joined game
 * @param data - the data
 */
GameClient.prototype.clientOnStartGame =
    function(data)
    {
		this.log("GameClient.clientOnStartGame " + "gameId: " + data.gameId);
    };

/**
 * on client chat message
 * @param data - the received data
 */
GameClient.prototype.clientOnChat =
	function(data)
	{
		switch (this.gameInstance.state)
		{
			case gameDefines.GAME_STATE_CREATED:
            case gameDefines.GAME_STATE_RUNNING:
            case gameDefines.GAME_STATE_OVER:
                if (data.countDown)
                {
                    if (data.countDown > 1000) // game countdown in progress
                    {
                        if (this.enableSounds)
                            gameResources.playSound(gameResources.SOUND_COUNTDOWN_BEEP);
                    }
                    else
                    {
                        if (this.enableSounds)
                            gameResources.playSound(gameResources.SOUND_START_GAME);
                    }
                }
				var chat_line = "[" + moment().format('HH:mm:ss') + "][" + (data.chatMode == -1?Lang.gettext("All"):Lang.gettext("Team")) + "] " +
								(data.playerName != ""?data.playerName+": ":"") + data.chatMessage + "\n";

				document.getElementById("textarea_Chat").value += chat_line;
				document.getElementById("textarea_Chat").scrollTop = document.getElementById("textarea_Chat").scrollHeight;
				document.getElementById("input_Chat").value = "";
				break;
		}
    };

/**
 * on client disconnect
 * @param data - the received data
 */
GameClient.prototype.clientOnDisconnect =
    function(data)
    {
        this.log("clientOnDisconnect received " + data);
    };

/**
 * on game over received from server
 * @param data - the received data
 */
GameClient.prototype.clientOnGameOver =
    function(data)
    {
        // do one last update for scores
        this.gameInstance.timer = data.timer;
        if (data.players.length)
        {
            this.gameInstance.players = [];
            for (var i = 0; i < data.players.length; i++)
            {
                var new_player = new GamePlayer(this.gameInstance);
                new_player.clientId = data.players[i].clientId;
                new_player.name = data.players[i].name;
                new_player.type = data.players[i].type;
                new_player.state = gameDefines.PLAYER_STATE_CONNECTED;
                new_player.score = data.players[i].score;
                this.gameInstance.players.push(new_player);

                if (new_player.clientId == this.clientId) // current player
                {
                    this.state = gameDefines.PLAYER_STATE_CONNECTED;
                    this.score = new_player.score;
                }
            }
        }

        // reset myself
		this.inputs = [];
		this.inputSequence = 0;
		this.lastInputSequence = 0;
		this.gameInstance.state = gameDefines.GAME_STATE_OVER;

        this.drawScores();
        // TODO:complete here
        // go to the score screen
    };

/**
 * server update
 * data is under the format
 *  {gameId, serverTime, noPlayers, tMap: [] {tMap,tHeight,tWidth}, players: [] {clientId,lastState,curState,position,inputSequence,state,score{type,overall}}}
 * @param data - date send
 */
GameClient.prototype.clientOnServerUpdate =
    function(data)
    {
        // update the state of the game
        this.gameInstance.state = data.state;
        switch (this.gameInstance.state)
        {
            case gameDefines.GAME_STATE_CREATED: // i am in a game lobby
                this.gameInstance.state = data.state;
                // update the players
                if (data.players.length)
                {
                    // reset the players
                    this.gameInstance.players = [];
                    for (var i = 0; i < data.players.length; i++)
                    {
                        var new_player = new GamePlayer(this.gameInstance);
                        new_player.clientId = data.players[i].clientId;
                        new_player.name = data.players[i].name;
                        new_player.type = data.players[i].type;
                        new_player.state = data.players[i].state;
                        new_player.isHuman = data.players[i].isHuman;
                        this.gameInstance.players.push(new_player);

                        if (new_player.clientId == this.clientId) // update myself
                        {
                            this.name = new_player.name;
                            this.type = new_player.type;
                            this.state = new_player.state;
                        }
                    }
                }
                break;
            case gameDefines.GAME_STATE_RUNNING: // game is running
                // update the players

                if (data.players.length)
                {

                    // update the game timers
                    this.gameInstance.timer = data.timer;

                    // update the local players to the server players
                    // if players have been added or remove take them into account

                    // reset the players
                    this.gameInstance.players = [];


                    for (var i = 0; i < data.players.length; i++) // for each player seen by the client
                    {
                        var new_player = new GamePlayer(this.gameInstance);
                        new_player.clientId = data.players[i].clientId;
                        new_player.name = data.players[i].name;
                        new_player.type = data.players[i].type;
                        if (!data.players[i].fogged) // player not in fog update its position - if player is in fog the server packet doesn't contain the position of the player (hacking this condition is useless)
                        {
                            new_player.lastState.position = data.players[i].lastState.position;
                            new_player.currentState.position = data.players[i].currentState.position;
                            new_player.position = data.players[i].currentState.position;
                            new_player.inputSequence = data.players[i].inputSequence;
                            new_player.lastInputSequence = data.players[i].lastInputSequence;
                            new_player.noTraps = data.players[i].noTraps;
                            new_player.event = data.players[i].event;
                        }
                        new_player.state = data.players[i].state;
                        new_player.score = data.players[i].score;
                        new_player.speed = data.players[i].speed;
                        new_player.timer = data.players[i].timer;
                        new_player.lastDrawingDirection = data.players[i].lastDrawingDirection;
                        new_player.isHuman = data.players[i].isHuman;
                        this.gameInstance.players.push(new_player);

                        if (new_player.clientId == this.clientId) // current player
                        {

                            // update the world if the maximum predicts has been reached to keep a somewhat real version of the server world
                            if ((new_player.lastInputSequence == 0 || new_player.lastInputSequence >= gameDefines.MAXIMUM_PREDICT_INPUTS) && data.world)
                            {
                                this.gameInstance.world.tHeight = data.world.tHeight;
                                this.gameInstance.world.tWidth = data.world.tWidth;

                                // update the map and the fog map based on the player type
                                this.gameInstance.world.tMap = data.world.tMap;

                                // updates the cartesian map
                                this.gameInstance.computeCartesianMap();

                                this.gameInstance.harvestedResources = data.harvestedResources;
                            }
                            this.event = new_player.event;
                            this.processStateUpdates(new_player);
                            // update myself
                            this.type = new_player.type;
                            this.state = new_player.state;
                            this.speed = new_player.speed;
                            this.timer = new_player.timer;
                            this.score = new_player.score;
                            this.lastDrawingDirection = new_player.lastDrawingDirection;
                            this.shadowPosition = new_player.position;

                            //this.logOnce(this.currentState.position.x + " " + this.currentState.position.y + " " + new_player.position.x + " " + new_player.position.y);
                            this.noTraps = new_player.noTraps;
                            if (new_player.inputSequence == this.inputSequence || this.inputSequence == 0) // update myself from the server
                            {
                                // clear the input
                                this.inputs.length = 0;
                                this.inputs = [];
                                this.inputSequence = 0;
                                this.lastInputSequence = 0;

                                // update myself
                                this.lastState.position = this.currentState.position;
                                this.currentState.position = new_player.currentState.position;
                                this.position = new_player.position;
                            }
                            else // reconciliation of the client position
                            {
                                // determine the player new position starting from the server position + the untreated server input (from server inputSequence)
                                var reconciliation_position = this.reconcileClientPosition(new_player.position, new_player.inputSequence);
                                this.lastState.position = this.currentState.position;
                                this.currentState.position = reconciliation_position;
                                this.position = reconciliation_position;
                            }
                        }
                    }
                }
                break;
            default:
                break;
        }

    };

/**
 * updates the local map based on the given map
 * @param tMap - the other tile map
 */
GameClient.prototype.updateMap =
    function(tMap)
    {

        for (var i = 0; i < this.gameInstance.world.tHeight; i++)
        {
            for (var j = 0; j < this.gameInstance.world.tWidth; j++)
            {
                if (this.gameInstance.world.tMap[i][j] == tMap[i][j])
                    this.gameInstance.world.tMapChanged[i][j] = false;
                else
                    this.gameInstance.world.tMapChanged[i][j] = true;
            }
        }

        return tMap;
    };

/**
 * processes the player states updates (including speed, jail, number of traps etc.)
 * @param newPlayer - the new states for this player (as a player)
 */
GameClient.prototype.processStateUpdates =
    function(newPlayer)
    {
        switch (this.state)
        {
            case gameDefines.PLAYER_STATE_PENDING: // player in lobby
            case gameDefines.PLAYER_STATE_READY:
                if (newPlayer.state == gameDefines.PLAYER_STATE_INGAME) // the game has started
                {
                    this.showScreen("game_board");
                }
                break;
            case gameDefines.PLAYER_STATE_INGAME: // player in game and not jailed
                switch (this.type)
                {
                    case gameDefines.PLAYER_HIDER:

                        if (this.event == gameDefines.PLAYER_EVENT_CAUGHT) // caught by a seeker
                        {
                            this.showEventPopup(gameDefines.PLAYER_EVENT_CAUGHT);
                            // empty any the remaining mouse path
                            this.selectedPath = [];
                            this.selectedPathInputs = [];
                        }


                        if (this.event == gameDefines.PLAYER_EVENT_RUN) // runs
                        {
                            this.showEventPopup(gameDefines.PLAYER_EVENT_RUN);
                        }

                        if (this.event == gameDefines.PLAYER_EVENT_TRAPPED) // trapped
                        {
                            this.showEventPopup(gameDefines.PLAYER_EVENT_TRAPPED);
                            if (this.enableSounds)
                                gameResources.playSound(gameResources.SOUND_TRAP);
                        }

                        if (this.event == gameDefines.PLAYER_EVENT_GRABGOLD) // grabs a gold
                        {
                            this.showEventPopup(gameDefines.PLAYER_EVENT_GRABGOLD);
                            if (this.enableSounds)
                                gameResources.playSound(gameResources.SOUND_GOLD);
                        }
                        break;
                    case gameDefines.PLAYER_SEEKER:
                        if (this.event == gameDefines.PLAYER_EVENT_PLANTTRAP) // plant a trap
                        {
                            this.showEventPopup(gameDefines.PLAYER_EVENT_PLANTTRAP);
                            if (this.enableSounds)
                                gameResources.playSound(gameResources.SOUND_TRAP);
                        }
                        if (this.event == gameDefines.PLAYER_EVENT_CATCH) // catches a hider
                            this.showEventPopup(gameDefines.PLAYER_EVENT_CATCH);
                        break;
                }
                break;
        }
    };

/**
 * reconciles the position of the player from the last server input sequence and up to the last treated client input sequence
 * @param serverPosition - the server position from which we reconciliate
 * @param serverInputSequence - the reported server input sequence
 * @return Object - the resulting position applied by the input vector
 */
GameClient.prototype.reconcileClientPosition =
    function(serverPosition, serverInputSequence)
    {
        var lis = this.lastInputSequence; // take a photo as it can change
        var resulting_position = serverPosition; // physics movement from new vector
        var x_dir = 0;
        var y_dir = 0;
        var input = {};
        var key = '';
        for (var i = serverInputSequence; i < lis; i++) // start from the last untreated sequence
        {
            input = this.inputs[i].inputs; // inputs for each input
            for(var j = 0; j < input.length; j++)
            {
                x_dir = 0;
                y_dir = 0;
                key = input[j];
                switch (key)
                {
                    case 'l':
                        x_dir -= 1 ;
                        break;
                    case 'r':
                        x_dir += 1 ;
                        break;
                    case 'u':
                        y_dir -= 1 ;
                        break;
                    case 'd':
                        y_dir += 1;
                        break;
                    default:
                        break;
                }
                var input_resulting_position = this.gameInstance.v_add(resulting_position, this.gameInstance.physicsMovementVectorFromDirection(x_dir, y_dir, this.inputs[i].speed, this.inputs[i].dt));
                var collisions = this.gameInstance.physicsGetCollisions(this, input_resulting_position); // get the collisions for the input
                collisions = this.gameInstance.gpRemoveGameRulesCollisions(this, collisions); // remove the game rules invalid collisions

                if (collisions.length > 0) // there are still collisions left - treat them
                {
                    // first check for any trivial collisions - a trivial collision is a movement blocking collision
                    var trivial_collisions = false;
                    for( var c = collisions.length-1; c >=0; c--)
                    if (collisions[c].element == gameDefines.OBJECT_WALL || collisions[c].element == gameDefines.OBJECT_CAVE)
                    {
                        trivial_collisions = true;
                        collisions.splice(c,1);// remove the trivial collision
                    }

                    // trivial collisions detected - ignore the input by reverting it
                    if (trivial_collisions)
                    {
                        switch (key)
                        {
                            case 'l':
                                x_dir += 1 ;
                                break;
                            case 'r':
                                x_dir -= 1 ;
                                break;
                            case 'u':
                                y_dir += 1;
                                break;
                            case 'd':
                                y_dir -= 1 ;
                                break;
                            default:
                                break;
                        }
                        continue; // treat next input
                    }
                    // non trivial collisions treat them client side
                    for(c = collisions.length-1; c >=0; c--)
                    {
                        if (this.gameInstance.world.tMap[collisions[c].l][collisions[c].c] == collisions[c].element) // map has not been updated locally
                        {
                            switch (collisions[c].element)
                            {
                                case gameDefines.OBJECT_GOLD: // collision of a hider with a gold coin
                                    // remove the gold locally
                                    this.gameInstance.world.tMap[collisions[c].l][collisions[c].c] = gameDefines.OBJECT_SPACE;
                                    break;
                                case gameDefines.OBJECT_TRAP: // collision of a hider with a trap
                                    // simulate locally the speed decrease
                                    this.gameInstance.world.tMap[collisions[c].l][collisions[c].c] = gameDefines.OBJECT_SPACE;
                                    break;
                                case gameDefines.PLAYER_SEEKER: // collision of a hider with a seeker
                                    break;
                                case gameDefines.PLAYER_HIDER: // collision of a seeker with a hider
                                    break;
                            }
                        }
                    }
                }

                // the input resulting position is ok, assign it to the result position
                resulting_position = input_resulting_position;
            }
        }

        //return the new position
        return resulting_position;
    };

/**
 * processes the client input starting from the last input sequence treated by the server
 * @return Object - the resulting position applied by the input vector
 */
GameClient.prototype.clientProcessInput =
    function()
    {
        try
        {
            var ic = this.inputs.length;

            if (ic > 0) // there are inputs - process them
            {
                switch (this.state)
                {
                    case gameDefines.PLAYER_STATE_INGAME: // player in game
                        var server_packet = {};
                        var result_position = this.currentState.position;
                        var input = {}; // inputs for each input
                        var x_dir = 0;
                        var y_dir = 0;
                        var special_1 = 0;
                        var special_2 = 0;
                        var key = '';

                        for (var i = this.lastInputSequence; i < ic; i++) // start from the last untreated sequence
                        {
                            input = this.inputs[i].inputs; // inputs for each input
                            special_1 = 0;
                            special_2 = 0;
                            for(var j = 0; j < input.length; j++)
                            {
                                key = input[j];
                                x_dir = 0;
                                y_dir = 0;

                                switch (key)
                                {
                                    case 'l':
                                        x_dir -= 1 ;
                                        break;
                                    case 'r':
                                        x_dir += 1 ;
                                        break;
                                    case 'u':
                                        y_dir -= 1 ;
                                        break;
                                    case 'd':
                                        y_dir += 1;
                                        break;
                                    case 's': // special move 1
                                        special_1 += 1;
                                        break;
                                    case 'c': // special move 2
                                        special_2 += 1;
                                        break;
                                    case 'a':
                                    default:
                                        break;
                                }
                                var input_resulting_position = this.gameInstance.v_add(result_position, this.gameInstance.physicsMovementVectorFromDirection(x_dir, y_dir, this.inputs[i].speed, this.inputs[i].dt));
                                var collisions = this.gameInstance.physicsGetCollisions(this, input_resulting_position); // get the collisions for the input
                                collisions = this.gameInstance.gpRemoveGameRulesCollisions(this, collisions); // remove the game rules invalid collisions

                                if (collisions.length > 0) // there are still collisions left - treat them
                                {
                                    // first check for any trivial collisions - a trivial collision is a movement blocking collision
                                    var trivial_collisions = false;
                                    for( var c = collisions.length-1; c >=0; c--)
                                        if (collisions[c].element == gameDefines.OBJECT_WALL || collisions[c].element == gameDefines.OBJECT_CAVE)
                                        {
                                            trivial_collisions = true;
                                            collisions.splice(c,1);// remove the trivial collision
                                        }

                                    // trivial collisions detected - ignore the input by reverting it
                                    if (trivial_collisions)
                                    {
                                        switch (key)
                                        {
                                            case 'l':
                                                x_dir += 1 ;
                                                break;
                                            case 'r':
                                                x_dir -= 1 ;
                                                break;
                                            case 'u':
                                                y_dir += 1;
                                                break;
                                            case 'd':
                                                y_dir -= 1 ;
                                                break;
                                            default:
                                                break;
                                        }
                                        continue; // trivial collision, treat the next input
                                    }
                                    // non trivial collisions treat them client side
                                    for(c = collisions.length-1; c >=0; c--)
                                    {
                                        if (this.gameInstance.world.tMap[collisions[c].l][collisions[c].c] == collisions[c].element) // map has not been updated locally
                                        {
                                            switch (collisions[c].element)
                                            {
                                                case gameDefines.OBJECT_GOLD: // collision of a hider with a gold coin
                                                    // remove the gold locally
                                                    this.gameInstance.world.tMap[collisions[c].l][collisions[c].c] = gameDefines.OBJECT_SPACE;
                                                    break;
                                                case gameDefines.OBJECT_TRAP: // collision of a hider with a trap
                                                    // simulate locally the speed decrease
                                                    this.gameInstance.world.tMap[collisions[c].l][collisions[c].c] = gameDefines.OBJECT_SPACE;
                                                    // compute the new direction up to this speed and reset the directions
                                                    this.speed *= this.gameInstance.TRAP_SPEED_PENALTY;
                                                    break;
                                                case gameDefines.PLAYER_SEEKER: // collision of a hider with a seeker
                                                    break;
                                                case gameDefines.PLAYER_HIDER: // collision of a seeker with a hider
                                                    break;
                                            }
                                        }
                                    }
                                }

                                // the input resulting position was ok so assign it to the result position
                                result_position = input_resulting_position;
                            }

                            // handle specials client side
                            if (special_1 > 0)
                                this.gameInstance.gpHandleSpecial(this);

                            // send the packet to the server to treat it - no need for the speed to be sent as server has it already
                            server_packet =
                            {
                                header: gameDefines.MESSAGE_CLIENT_INPUT,
                                gameId: this.gameInstance.gameId,
                                clientId: this.clientId,
                                inputSequence : this.inputs[i].inputSequence,
                                dt: this.inputs[i].dt,
                                inputs: input
                            };
                            this.ioConnection.emit("message", server_packet);
                        }

                        //return the new position
                        return result_position;
                        break;
                    default:
                        break;
                }
            }

            return null;
        }
        catch (ex)
        {
            this.log("GameClient.prototype.clientProcessInput " + ex);
        }

    };

/**
 * on client input (keyboard/mouse) handler
 * @param forcedInput - forced input (used by mouse paths)
 * @param deltaTime - the input delta time
 */
GameClient.prototype.clientOnInput =
    function (forcedInput, deltaTime)
    {
        if (document.activeElement == document.getElementById("input_Chat")) // if chat is active
            return;

        var input = []; // the input array
        // push the forced input
        for (var i = 0; i < forcedInput.length; i++)
            input.push(forcedInput[i]);

        var server_packet = {};

        switch (this.state)
        {
            case gameDefines.PLAYER_STATE_INGAME: // player in game and not jailed
                if (this.keyboard.pressed('left'))
                {
                    input.push("l");
                    this.selectedPath = [];
                    this.selectedPathInputs = [];
                }
                if (this.keyboard.pressed('right'))
                {
                    input.push("r");
                    this.selectedPath = [];
                    this.selectedPathInputs = [];
                }
                if (this.keyboard.pressed('up'))
                {
                    input.push("u");
                    this.selectedPath = [];
                    this.selectedPathInputs = [];
                }
                if (this.keyboard.pressed('down'))
                {
				    input.push("d");
                    this.selectedPath = [];
                    this.selectedPathInputs = [];
                }
				if (this.keyboard.pressed('space')) // TODO: ignore if space already down
				{
					input.push("s");
				}
				if (this.keyboard.pressed('c'))
					input.push("c");

				if (this.keyboard.pressed('enter'))
				{
					// TODO: implement game chat here
				}

                if (input.length)
                {
                    if (input[input.length-1] != "s" && input[input.length-1] != "c")
                        this.lastDrawingDirection = input[input.length-1];

                    this.inputSequence += 1; // increase the input sequence and push the input
                    var dt = this.gameInstance._dt;
                    if (deltaTime) // given
                        dt = deltaTime;
                    this.inputs.push(
                        {
                            inputs : input,
                            lastFrameTime: this.gameInstance.lastFrameTime,
                            dt: dt,
                            speed: this.speed,
                            inputSequence : this.inputSequence
                        });
                }
                break;
            default:
                break;
        }
    };

/**
 * treats the inputs from the selected path for each time frame
 * @param noInputs - number of inputs to be treated equivalent to the number of inputs possible for a time frame
 */
GameClient.prototype.treatSelectedPathInputs =
    function (noInputs)
    {
        try
        {
            if (this.selectedPathInputs.length < 1) // no elements
                return;

            var inputs = new Array();
            var path_sequence = 0;
            for (var i = 0; i < Math.min(noInputs, this.selectedPathInputs.length); i++)
            {
                var path = this.selectedPathInputs[i];
                inputs = [];
                inputs.push(path.direction);
                this.clientOnInput(inputs, this.selectedPathDeltaTime);
                path_sequence = path.sequence;
            }

            // remove the treated inputs
            this.selectedPathInputs.splice(0, Math.min(noInputs, this.selectedPathInputs.length));

            // if the path sequence has change remove it from the selectedPath
            if ((this.selectedPathInputs.length && this.selectedPathInputs[0].sequence != path_sequence) || this.selectedPathInputs.length == 0)
            {
                this.selectedPath.splice(0, 1);
                this.rebuildPath();
            }
        }
        catch (ex)
        {
            this.logOnce("GameClient.prototype.treatSelectedPathInputs " + ex);
        }
    };

/**
 * rebuilds the mouse path based on the new delta times
 */
GameClient.prototype.rebuildPath =
    function()
    {
        // transform the selected path in a series of key inputs corresponding in concordance with the movement delta
        var inputs = [];
        // keep the last sequence if any
        this.selectedPathInputs = [];
        var position = {x:this.position.x + this.dx/2, y:this.position.y + this.dy/2};
        this.selectedPathDeltaTime = this.gameInstance._dt;
        var movement_delta = (this.selectedPathDeltaTime * this.speed).fixed(3); // movement delta

        for (var i = 0; i < this.selectedPath.length; i++)
        {
            var no_splits = 0; // number of splits
            var target_position = this.gameInstance.getPositionByTile(this.selectedPath[i].tile);

            // split the tile into smaller movements in the same direction corresponding to the movement delta
            switch (this.selectedPath[i].direction)
            {

                case "l": // try left from the current position until the center of the left tile
                    while ((position.x - target_position.x) >= movement_delta && no_splits < gameDefines.TILE_WIDTH)
                    {
                        no_splits ++;
                        position = this.gameInstance.v_add(position, this.gameInstance.physicsMovementVectorFromDirection(-1, 0, this.speed, this.selectedPathDeltaTime));
                    }
                    break;
                case "r":
                    while ((position.x - target_position.x) <= movement_delta && no_splits < gameDefines.TILE_WIDTH)
                    {
                        no_splits ++;
                        position = this.gameInstance.v_add(position, this.gameInstance.physicsMovementVectorFromDirection(1, 0, this.speed, this.selectedPathDeltaTime));
                    }
                    break;
                case "u":
                    while ((position.y - target_position.y) >= movement_delta && no_splits < gameDefines.TILE_HEIGHT)
                    {
                        no_splits ++;
                        position = this.gameInstance.v_add(position, this.gameInstance.physicsMovementVectorFromDirection(0, -1, this.speed, this.selectedPathDeltaTime));
                    }
                    break;
                case "d":
                    while ((position.y - target_position.y) <= movement_delta && no_splits < gameDefines.TILE_HEIGHT)
                    {
                        no_splits ++;
                        position = this.gameInstance.v_add(position, this.gameInstance.physicsMovementVectorFromDirection(0, 1, this.speed, this.selectedPathDeltaTime));
                    }
                    break;

            }
            for (var j = 0; j < no_splits; j++)
            {
                inputs.push(this.selectedPath[i].direction);
                this.selectedPathInputs.push({direction:this.selectedPath[i].direction, sequence:i});
            }
        }
        /*
        var tmp = "";
        for (i = 0; i < this.selectedPathInputs.length; i++)
            tmp += this.selectedPathInputs[i].direction + " " + this.selectedPathInputs[i].sequence ;
        this.log(tmp);
        /**/
    };

/**
 * gets the paths to the destination recursively
 * @param currentTile - the current tile
 * @param destinationTile - the destination tile
 * @param direction - the direction
 * @param path - the direction path
 * @param visited - the visited array used for the greedy
 * */
GameClient.prototype.computePath =
    function (currentTile, destinationTile, direction, path, visited)
    {
        if (currentTile.l == destinationTile.l && currentTile.c == destinationTile.c) // destination reached
        {
            if (path.length < this.pathLength)
            {
                this.pathLength = path.length;
                this.selectedPath = [];
                for (var i = 0; i < path.length; i++)
                    this.selectedPath.push({tile:visited[i], direction: path[i]});
                /*
                var tmp = this.selectedPath.length;
                for (i = 0; i < this.selectedPath.length; i++)
                    tmp += this.selectedPath[i].direction + " ";
                this.log(tmp);
                /**/
            }
        }
        else // destination not reached
        {
            if (path.length < this.pathLength) // the current path is smaller than a found path done, try alongside this path
            {
                // choose the next direction based on the minimum manhattan distances
                var try_directions = new Array();
                try_directions.push({tile: {l:currentTile.l, c: currentTile.c-1}, direction:"l"});
                try_directions.push({tile: {l:currentTile.l, c: currentTile.c+1}, direction:"r"});
                try_directions.push({tile: {l:currentTile.l-1, c: currentTile.c}, direction:"u"});
                try_directions.push({tile: {l:currentTile.l+1, c: currentTile.c}, direction:"d"});

                // order the try directions by the manhattan distance
                try_directions = try_directions.sort(function(a,b)
                {
                    return (gameUtils.getDistanceBetweenTiles(a.tile, destinationTile) -
                                gameUtils.getDistanceBetweenTiles(b.tile, destinationTile));
                });

                // try the tiles
                for (var i = 0; i < try_directions.length; i++)
                {
                    var next_tile = try_directions[i].tile;
                    if (this.gameInstance.isTileMovementValid(this.type, next_tile)
                        && !gameUtils.containsTile(visited, next_tile))
                        {
                            visited.push(next_tile);
                            path.push(try_directions[i].direction);
                            this.computePath(next_tile, destinationTile, try_directions[i].direction, path, visited);
                        }
                }
            }
        }
        path.pop();
        visited.pop();

    };

/**
 * gets the closest (in manhattan distance) valid tile for movement(used by mouse movement)
 * @param tile - the tile
 * @return Object - the closest valid tile (l,c)
 */
GameClient.prototype.getClosestValidMovementTile =
    function(tile)
    {
        var player_tile = this.gameInstance.getPlayerTile(this);
        var starting_point = 1;
        var valid_tile = false;
        var result_tile = {l:0, c:0};
        var distance = this.gameInstance.world.tHeight * this.gameInstance.world.tWidth;

        if (this.gameInstance.isTileMovementValid(this.type, tile))
            return tile;

        // non valid tile begin to wonder in circles around it
        while (!valid_tile && starting_point < Math.max(this.gameInstance.world.tHeight, this.gameInstance.world.tWidth))
        {
            for (var i = -starting_point; i <= starting_point; i++) // try the area around it
                for (var j = -starting_point; j <= starting_point; j++)
                {
                    var next_tile = {l:tile.l + i, c: tile.c + j};
                    //this.log(next_tile.l + " " + next_tile.c);
                    if (next_tile.l >= 0 && next_tile.l < this.gameInstance.world.tHeight && next_tile.c >= 0 && next_tile.c < this.gameInstance.world.tWidth)
                    {
                        if (this.gameInstance.isTileMovementValid(this.type, next_tile))
                        {
                            valid_tile = true;
                            // get the distance and switch the result tile only if the distance is smaller
                            if (gameUtils.getDistanceBetweenTiles(player_tile, next_tile) < distance)
                            {
                                result_tile = {l:next_tile.l, c:next_tile.c};
                                distance = gameUtils.getDistanceBetweenTiles(player_tile, next_tile);
                            }
                        }
                    }
                }
            if (valid_tile) // one valid tile found
                return result_tile;
            starting_point += 1;
        }

        return tile;
    };


/**
 * pings the server each second
 */
GameClient.prototype.clientCreatePing =
    function()
    {

        setInterval(
            function()
            {
                try
                {
                    this.pingTime = new Date();
                    var server_packet =
                    {
                        header: gameDefines.MESSAGE_CLIENT_PING,
                        type: this.type,
                        name: this.name
                    };
                    this.ioConnection.emit("message", server_packet);
                }
                catch (err)
                {
                    this.logOnce("GameClient.prototype.clientCreatePing " + err);
                }
            }.bind(this), gameDefines.PING_INTERVAL);
    };

/**
 * client physics simulation - local client loop
 */
GameClient.prototype.clientCreatePhysicsSimulation =
    function()
    {
        setInterval(
            function()
            {
                try
                {
                    this.gameInstance._pdt = (new Date().getTime() - this.gameInstance._pdte)/1000.0;
                    this.gameInstance._pdte = new Date().getTime();
                    this.gameInstance.localTime += this.gameInstance._pdt.fixed();

                    this.clientUpdatePhysics();
                }
                catch (err)
                {
                    this.logOnce("GameClient.prototype.clientCreatePhysicsSimulation " + err);
                }
            }.bind(this), gameDefines.CLIENT_UPDATE_PHYSICS_LOOP);
    };

/**
 * updates the players position locally
 * uses interpolation for the other players
 */
GameClient.prototype.clientUpdateLocalPositions =
    function()
    {
        // update my position
        this.position = this.currentState.position;

        // update the other players positions
        var lerp_modifier = 1 / ((1 / this.gameInstance._dt) * ((gameDefines.SERVER_UPDATE_LOOP + Math.min(this.pingValue, 200)) / 1000)); // interpolation modifier - takes into account the client fps & the server lag (capped at 200)
        //this.logOnce(lerp_modifier);
        for (var i = 0; i < this.gameInstance.players.length; i++)
        {
            if (this.gameInstance.players[i].clientId != this.clientId) // not the current client
            {
                var player = this.gameInstance.players[i];
                player.position = this.gameInstance.v_lerp(player.lastState.position, player.currentState.position, player.interpTimeFrame * lerp_modifier);
                player.interpTimeFrame += 1;
            }
        }
    };

/**
 * updates the drawing offset for map scrolling
 */
GameClient.prototype.updateDrawingOffset =
    function()
    {
        var width = gameDefines.CANVAS_WIDTH;
        var height = gameDefines.CANVAS_HEIGHT;

        // player not in the area do a reupdate of its drawing position
        if (!gameUtils.isAreaInArea(this.position, {x:this.position.x+this.dx, y:this.position.y+this.dy}, this.drawingOffset.positionTopLeft, this.drawingOffset.positionBottomRight))
        {
            this.drawingOffset.positionTopLeft.x = Math.min(Math.floor(this.position.x / width) * width, this.gameInstance.world.width - gameDefines.CANVAS_WIDTH);
            this.drawingOffset.positionTopLeft.y = Math.min(Math.floor(this.position.y / height) * height, this.gameInstance.world.height - gameDefines.CANVAS_HEIGHT);
            this.drawingOffset.positionBottomRight.x = Math.min(this.drawingOffset.positionTopLeft.x + gameDefines.CANVAS_WIDTH, this.gameInstance.world.width);
            this.drawingOffset.positionBottomRight.y = Math.min(this.drawingOffset.positionTopLeft.y + gameDefines.CANVAS_HEIGHT, this.gameInstance.world.height);
        }

        if (this.drawingOffset.positionTopLeft.x > 0 && (this.position.x - this.drawingOffset.positionTopLeft.x) < this.gameInstance.FOG_AREA * gameDefines.TILE_WIDTH) // left passage
            this.drawingOffset.positionTopLeft.x = Math.max(Math.floor(this.position.x/gameDefines.TILE_WIDTH) * gameDefines.TILE_WIDTH + (this.gameInstance.FOG_AREA*2) * gameDefines.TILE_WIDTH - gameDefines.CANVAS_WIDTH, 0);
        if (this.drawingOffset.positionBottomRight.x < this.gameInstance.world.width && (this.drawingOffset.positionBottomRight.x - this.position.x) < (this.gameInstance.FOG_AREA+1) * gameDefines.TILE_WIDTH ) // right passage
            this.drawingOffset.positionTopLeft.x = Math.min(Math.floor(this.position.x/gameDefines.TILE_WIDTH) * gameDefines.TILE_WIDTH - (this.gameInstance.FOG_AREA+1) * gameDefines.TILE_WIDTH, this.gameInstance.world.width - gameDefines.CANVAS_WIDTH);
        if (this.drawingOffset.positionTopLeft.y > 0 && (this.position.y - this.drawingOffset.positionTopLeft.y) < this.gameInstance.FOG_AREA * gameDefines.TILE_HEIGHT) // up passage
            this.drawingOffset.positionTopLeft.y = Math.max(Math.floor(this.position.y/gameDefines.TILE_HEIGHT) * gameDefines.TILE_HEIGHT + (this.gameInstance.FOG_AREA*2) * gameDefines.TILE_HEIGHT - gameDefines.CANVAS_HEIGHT, 0);
        if (this.drawingOffset.positionBottomRight.y < this.gameInstance.world.height && (this.drawingOffset.positionBottomRight.y - this.position.y) < (this.gameInstance.FOG_AREA+1) * gameDefines.TILE_HEIGHT ) // down passage
            this.drawingOffset.positionTopLeft.y = Math.min(Math.floor(this.position.y/gameDefines.TILE_HEIGHT) * gameDefines.TILE_HEIGHT - (this.gameInstance.FOG_AREA+1) * gameDefines.TILE_HEIGHT, this.gameInstance.world.height - gameDefines.CANVAS_HEIGHT);

        this.drawingOffset.positionBottomRight.x = Math.min(this.drawingOffset.positionTopLeft.x + gameDefines.CANVAS_WIDTH, this.gameInstance.world.width);
        this.drawingOffset.positionBottomRight.y = Math.min(this.drawingOffset.positionTopLeft.y + gameDefines.CANVAS_HEIGHT, this.gameInstance.world.height);

    };

/**
 * gets the drawing position for a given tile/player
 * @param positionTopLeft - the given position (x,y) top left corner
 * @param positionBottomRight - the given position (x,y) bottom right
 * @return Object - the drawing position (top left) in relation with the displayed drawing area
 */
GameClient.prototype.getDrawingPosition =
    function(positionTopLeft, positionBottomRight)
    {
        var result_position = {x:positionTopLeft.x, y:positionTopLeft.y};
        if (positionTopLeft.x >= this.drawingOffset.positionTopLeft.x && positionTopLeft.x <= this.drawingOffset.positionBottomRight.x &&
            positionTopLeft.y >= this.drawingOffset.positionTopLeft.y && positionTopLeft.y <= this.drawingOffset.positionBottomRight.y &&
            positionBottomRight.x >= this.drawingOffset.positionTopLeft.x && positionBottomRight.x <= this.drawingOffset.positionBottomRight.x &&
            positionBottomRight.y >= this.drawingOffset.positionTopLeft.y && positionBottomRight.y <= this.drawingOffset.positionBottomRight.y)
        {
            result_position.x = positionTopLeft.x - this.drawingOffset.positionTopLeft.x;
            result_position.y = positionTopLeft.y - this.drawingOffset.positionTopLeft.y;
            return result_position;
        }

        return {x:-100,y:-100};
    };

/**
 * client update loop
 * @param t - time frame
 */
GameClient.prototype.clientUpdate =
    function(t)
    {
        try
        {
            if (this.gameInstance.state == gameDefines.GAME_STATE_RUNNING) // only if game is running
            {
                //Work out the delta time
                this.gameInstance._dt = this.gameInstance.lastFrameTime ? ( (t - this.gameInstance.lastFrameTime)/1000.0).fixed() : 0.016;

                //Store the last frame time
                this.gameInstance.lastFrameTime = t;

                // treats the mouse inputs
                this.treatSelectedPathInputs(1);

                // treat the input from the client keyboard
                this.clientOnInput([], null);

                // client prediction & interpolation of the other clients
                this.clientUpdateLocalPositions();

                // update the drawing offset
                this.updateDrawingOffset();

                // clear the background and player canvas
                this.gContext.background.clearRect(0, 0, this.gameInstance.world.width + gameDefines.CANVAS_WIDTH, this.gameInstance.world.height + gameDefines.CANVAS_HEIGHT);
                this.gContext.players.clearRect(0, 0, this.gameInstance.world.width + gameDefines.CANVAS_WIDTH, this.gameInstance.world.height + gameDefines.CANVAS_HEIGHT);
            }

            // draw myself
            this.draw();
        }
        catch (err)
        {
            this.logOnce("GameClient.prototype.clientUpdate " + err);
        }

        //schedule the next update
        this.updateid = window.requestAnimationFrame( this.clientUpdate.bind(this), this.canvas.background);

    };

/**
 * client update physics
 */

GameClient.prototype.clientUpdatePhysics =
    function()
    {
        // change the old state with the current one
        this.lastState.position = this.currentState.position;
        // process the input
        var new_position = this.clientProcessInput();
        // update the last input sequence
        this.lastInputSequence = this.inputSequence;
        // add the position
        if (this.state == gameDefines.PLAYER_STATE_INGAME && new_position) // player is in game and the new direction is valid
            this.currentState.position = new_position; //this.gameInstance.v_add( this.lastState.position, new_direction);
    };

/*********************************************************
 * DRAWING GRAPHICS FUNCTIONS
 * ******************************************************/

/**
 * initializes the icons based on the player type
 */
GameClient.prototype.initIconsByPlayerType =
    function ()
    {
        switch (this.type)
        {
            case gameDefines.PLAYER_HIDER:
                document.getElementById("img_playerScore").setAttribute("src", "./res/icons/icon_gold.png");
                document.getElementById("img_playerSpecial1").setAttribute("src", "./res/icons/icon_speed_boost.png");
                document.getElementById("img_playerSpeedSlow").setAttribute("src", "./res/icons/icon_speed_slow_deactivated.png");
                document.getElementById("img_playerSpeedBoost").setAttribute("src", "./res/icons/icon_speed_boost_deactivated.png");
                document.getElementById("img_playerJail").setAttribute("src", "./res/icons/icon_jail_deactivated.png");
                document.getElementById("img_playerSpeed").style.display = "inline";
                document.getElementById("text_playerSpeed").style.display = "inline";
                document.getElementById("p_playerInfo3").style.display = "block";
                document.getElementById("p_playerInfo31").style.display = "block";
                break;
            case gameDefines.PLAYER_SEEKER:
                //document.getElementById("img_playerType").setAttribute("src", "./res/icons/icon_seeker.png");
                document.getElementById("img_playerScore").setAttribute("src", "./res/icons/icon_prison.png");
                document.getElementById("img_playerSpecial1").setAttribute("src", "./res/icons/icon_trap.png");
                document.getElementById("img_playerSpeed").style.display = "none";
                document.getElementById("text_playerSpeed").style.display = "none";

                document.getElementById("p_playerInfo3").style.display = "none";
                document.getElementById("p_playerInfo31").style.display = "none";
                break;
        }
    };

/**
 * shows and hides the various GUI elements based on the current screen
 * @param screen - the screen corresponding to the div name
 */
GameClient.prototype.showScreen =
    function(screen)
    {
        switch (screen)
        {
            case "game_pick":
                // hide
                document.getElementById("game_scores").style.display = "none";
                document.getElementById("game_lobby").style.display = "none";
                document.getElementById("game_lobby_info").style.display = "none";
                document.getElementById("game_board").style.display = "none";
                document.getElementById("game_board_info").style.display = "none";
                document.getElementById("game_debug_info").style.display = "none";
                document.getElementById("game_chat").style.display = "none";

                // show
                document.getElementById("game_pick").style.display = "block";
                document.getElementById("game_pick_info").style.display = "block";
                document.getElementById("text_invalidName").style.display = "none";
                document.getElementById("but_JoinGame").removeAttribute("disabled");
                document.getElementById("but_JoinGame").innerHTML = Lang.gettext("Play");

				// clear
				document.getElementById("textarea_Chat").value = "";
                break;
            case "game_lobby":
                // hide
                document.getElementById("game_pick").style.display = "none";
                document.getElementById("game_pick_info").style.display = "none";
                document.getElementById("game_scores").style.display = "none";
                document.getElementById("game_board").style.display = "none";
                document.getElementById("game_board_info").style.display = "none";

                // show
                document.getElementById("label_StartGame").style.display = "block";
                document.getElementById("game_lobby").style.display = "block";
                document.getElementById("game_lobby_info").style.display = "block";
                document.getElementById("but_StartGame").removeAttribute("disabled");
                document.getElementById("but_StartGame").innerHTML = Lang.gettext("Ready");
                document.getElementById("game_chat").style.display = "block";
                break;
            case "game_board":
                // hide
                document.getElementById("game_pick").style.display = "none";
                document.getElementById("game_pick_info").style.display = "none";
                document.getElementById("game_lobby").style.display = "none";
                document.getElementById("game_lobby_info").style.display = "none";
                document.getElementById("game_scores").style.display = "none";

                // show
                document.getElementById("game_board").style.display = "block";
                document.getElementById("game_board_info").style.display = "block";
                if (gameDefines.DEBUG_MODE) // only in debug mode
                    document.getElementById("game_debug_info").style.display = "block";
                document.getElementById("game_chat").style.display = "block";
                break;
            case "game_scores":
                // hide
                document.getElementById("game_pick").style.display = "none";
                document.getElementById("game_pick_info").style.display = "none";
                document.getElementById("game_lobby").style.display = "none";
                document.getElementById("game_lobby_info").style.display = "none";
                document.getElementById("game_board").style.display = "none";
                document.getElementById("game_chat").style.display = "none";

                // show
                document.getElementById("game_scores").style.display = "block";
                break;
        }
    }

/**
 * shows the event with the given message
 * the event resets automatically after a number of seconds
 * @param event - the player event
 */
GameClient.prototype.showEventPopup =
    function(event)
    {
        var img = document.getElementById("img_playerEvent");

        switch (event)
        {
            case gameDefines.PLAYER_EVENT_GRABGOLD:
                img.setAttribute("src", "./res/anims/gold.gif");
                break;
            case gameDefines.PLAYER_EVENT_CAUGHT:
                img.setAttribute("src", "./res/anims/jail.gif");
                break;
            case gameDefines.PLAYER_EVENT_CAUGHT:
                img.setAttribute("src", "./res/anims/jail.gif");
                break;
            case gameDefines.PLAYER_EVENT_PLANTTRAP:
                img.setAttribute("src", "./res/anims/trap.gif");
                break;
            case gameDefines.PLAYER_EVENT_TRAPPED:
                img.setAttribute("src", "./res/anims/trap.gif");
                break;
            case gameDefines.PLAYER_EVENT_RUN:
                img.setAttribute("src", "./res/anims/run.gif");
                break;
        }
    };

/**
 * drawing function
 */
GameClient.prototype.draw =
    function()
    {
        // draw the game info
        this.drawGameInfo(this.gameInstance.state);

        if (this.gameInstance.state == gameDefines.GAME_STATE_RUNNING) // draw the map and players only if game is running
        {
            // draw the map
            this.drawMap();

            // draw the other players
            this.drawPlayers();

            // draw self
            switch (this.state)
            {
                case gameDefines.PLAYER_STATE_INGAME:
                case gameDefines.PLAYER_STATE_JAILED:
                    this.drawPlayer(this, gameDefines.POV_ME);
                    break;
                default:
                    break;
            }

			// draw the chat area
			this.drawChat();
        }
    };


/**
 * draws and shows the game scores
 */
GameClient.prototype.drawChat =
	function()
	{
		// TODO: implement game chat
	};

/**
 * draws and shows the game scores
 */
GameClient.prototype.drawScores =
    function()
    {
        var hiders = "<td class='game_lobby'></td><td class='game_score'>" + Lang.gettext("Gold gathered") + "</td><td class='game_score'>" + Lang.gettext("Times caught") + "</td><td class='game_score'>" + Lang.gettext("Overall") + "</td>";
        var seekers = "<td class='game_lobby'></td><td class='game_score'>" + Lang.gettext("Seekers caught") + "</td><td class='game_score'>" + Lang.gettext("") + "</td><td class='game_score'>" + Lang.gettext("Overall") + "</td>";
        var line = "";
        var player = {};

        for (var p = 0; p < this.gameInstance.players.length; p++)
        {
            player = this.gameInstance.players[p];

            // name column
            line = "<td class='game_lobby'>";
            if (player.clientId == this.clientId)
                line += "<b>" + this.gameInstance.players[p].name + "</b>";
            else
                line += this.gameInstance.players[p].name;
            line += "</td>";
            line += "<td class='game_score'>" + player.score.typeScore + "</td>";


            // table line
            if (player.type == gameDefines.PLAYER_HIDER)
            {
                line += "<td class='game_score'>" + player.score.timesCaught + "</td>";
                line += "<td class='game_score'>" + player.score.overallScore + "</td>";
                hiders += "<tr>" + line + "</tr>\n";

            }
            else
            {
                line += "<td class='game_score'>" + Lang.gettext("N/A") + "</td>";
                line += "<td class='game_score'>" + player.score.overallScore + "</td>";
                seekers += "<tr>" + line + "</tr>\n";
            }
        }

        // add the empty slots
        for (var i = this.gameInstance.getNoPlayers(gameDefines.PLAYER_HIDER); i < Number(this.gameInstance.MAX_PLAYERS_PER_GAME / 2); i++)
            hiders += "<tr><td class='game_lobby'>" + Lang.gettext("None") + "</td><td class='game_score'>0</td><td class='game_score'>0</td><td class='game_score'>0</td></tr>\n";
        for (var i = this.gameInstance.getNoPlayers(gameDefines.PLAYER_SEEKER); i < Number(this.gameInstance.MAX_PLAYERS_PER_GAME / 2); i++)
            seekers += "<tr><td class='game_lobby'>" + Lang.gettext("None") + "</td><td class='game_score'>0</td><td class='game_score'>" + Lang.gettext("N/A") + "</td><td class='game_score'>0</td></tr>\n";

        document.getElementById("span_scoreHiders").innerHTML = "<table>\n" + hiders + "</table>\n";
        document.getElementById("span_scoreSeekers").innerHTML = "<table>\n" + seekers + "</table>\n";

        var clt = this;
        // show the score screen after 3 seconds
        setTimeout( function()
        {
            clt.showScreen("game_scores");
        }, 2000);
    };

/**
 * draws the game information part
 * @param gameState - the current state of the game
 */
GameClient.prototype.drawGameInfo =
    function(gameState)
    {
        switch (gameState)
        {
            case gameDefines.GAME_STATE_CREATED: // lobby screen
                //document.getElementById("text_GameId").innerHTML = "";//this.name + " " + Lang.gettext(" is in the game");
                // add the empty slots
                var hiders = "";
                var seekers = "";
                var line = "";
                var player = {};
                var no_seekers = 0;
                var no_hiders = 0;
                for (var p = 0; p < this.gameInstance.players.length; p++)
                {
                    player = this.gameInstance.players[p];

                    // name column
                    line = "<td class='game_lobby'>";
                    if (player.clientId == this.clientId)
                        line += "<b>" + this.gameInstance.players[p].name + "</b>";
                    else
                        line += this.gameInstance.players[p].name;
                    line += "</td>";

                    // status column
                    if (player.state == gameDefines.PLAYER_STATE_READY) // show the ready players
                        line += "<td class='game_lobby_info' style='color:#00FF00'>" + Lang.gettext("Ready");
                    else
                        line += "<td class='game_lobby_info' style='color:#E9DC51'>" + Lang.gettext("Waiting to be ready ...");
                    line += "</td>";

                    // table line
                    if (player.type == gameDefines.PLAYER_HIDER)
                    {
                        hiders += "<tr>" + line + "</tr>\n";
                        no_hiders ++;
                    }
                    else
                    {
                        seekers += "<tr>" + line + "</tr>\n";
                        no_seekers ++;
                    }
                }

                for (var i = no_hiders; i < Number(this.gameInstance.MAX_PLAYERS_PER_GAME / 2); i++)
                    hiders += "<tr><td class='game_lobby'>" + Lang.gettext("Open") + "</td>" + "<td class='game_lobby_info'>" + Lang.gettext("Not joined yet") + "</td></tr>\n";
                for (var i = no_seekers; i < Number(this.gameInstance.MAX_PLAYERS_PER_GAME / 2); i++)
                    seekers += "<tr><td class='game_lobby'>" + Lang.gettext("Open") + "</td>" + "<td class='game_lobby_info'>" + Lang.gettext("Not joined yet") + "</td></tr>\n";

                if (hiders == "") // no hiders
                    hiders = "<p>" + Lang.gettext("No hiders have joined the game yet") + "</p>";
                if (seekers == "") // no hiders
                    seekers = "<p>" + Lang.gettext("No seekers have joined the game yet") + "</p>";
                document.getElementById("span_lobbyHiders").innerHTML = "<table>\n" + hiders + "</table>\n";
                document.getElementById("span_lobbySeekers").innerHTML = "<table>\n" + seekers + "</table>\n";
                break;

            case gameDefines.GAME_STATE_RUNNING: // game is running
                // update the game information gui
                document.getElementById("noPlayers").innerHTML = this.gameInstance.players.length;
                // update the delta time
                document.getElementById("msPerFrame").innerHTML = this.gameInstance._dt.fixed();
                // update the physical update time
                document.getElementById("msPhysicalUpdate").innerHTML = this.gameInstance._pdt.fixed();
                // update the physical update time
                document.getElementById("movDelta").innerHTML = (this.gameInstance._dt.fixed() * this.speed).fixed();

                // game status
                var no_hiders = 0;
                var no_seekers = 0;
                var jailed_hiders = 0;
                var player = {};
                for (var p = 0; p < this.gameInstance.players.length; p++)
                {
                    player = this.gameInstance.players[p];
                    if (player.type == gameDefines.PLAYER_HIDER)
                        no_hiders ++;
                    else
                        no_seekers ++;
                    if (player.state == gameDefines.PLAYER_STATE_JAILED)
                        jailed_hiders ++;
                }
                document.getElementById("text_gameRunners").innerHTML = Number(no_hiders).pad(2);
                document.getElementById("text_gameChasers").innerHTML = Number(no_seekers).pad(2);
                document.getElementById("text_gameGold").innerHTML = Number(this.gameInstance.TOTAL_GOLD - this.gameInstance.harvestedResources).pad(2);
                document.getElementById("text_gameJail").innerHTML = Number(jailed_hiders).pad(2);

                // END game status

                // player status

                // update the name

                document.getElementById("text_playerName").innerHTML = this.name;
                if (this.type == gameDefines.PLAYER_SEEKER)
                    document.getElementById("text_playerName").innerHTML += " (" + Lang.gettext("Team seekers") + ")";
                else
                    document.getElementById("text_playerName").innerHTML += " (" + Lang.gettext("Team hiders") + ")";

                document.getElementById("text_gameRemainingTime").innerHTML = gameUtils.fromMsToIntSeconds(this.gameInstance.timer.cdDuration / 60).pad(2) + ":" +
                                                                                (gameUtils.fromMsToIntSeconds(this.gameInstance.timer.cdDuration) % 60).pad(2);
                // update the score
                document.getElementById("text_playerScore").innerHTML = (this.score.overallScore <= 99 ? Math.floor(this.score.overallScore).pad(2): Math.floor(this.score.overallScore).pad(3));
                // update the client speed
                document.getElementById("text_playerSpeed").innerHTML = Number(Math.floor(this.speed)).pad(2);

                // player type specific elements
                switch (this.type)
                {
                    case gameDefines.PLAYER_HIDER:
                        // speed burst cool down
                        if (this.timer.cdSpeed > 0)
                        {
                            document.getElementById("img_playerSpecial1").setAttribute("src", "./res/icons/icon_speed_boost_deactivated.png");
                            document.getElementById("text_playerSpecial1").innerHTML = gameUtils.fromMsToIntSeconds(this.timer.cdSpeed).pad(2);
                        }
                        else
                        {
                            document.getElementById("img_playerSpecial1").setAttribute("src", "./res/icons/icon_speed_boost.png");
                            document.getElementById("text_playerSpecial1").innerHTML = "RDY";
                        }

                        // speed burst timer
                        if (this.timer.speedBurst > 0) // a speed burst is in progress
                            document.getElementById("img_playerSpeedBoost").setAttribute("src", "./res/icons/icon_speed_boost.png");
                        else
                            document.getElementById("img_playerSpeedBoost").setAttribute("src", "./res/icons/icon_speed_boost_deactivated.png");
                        document.getElementById("text_playerSpeedBoostTimer").innerHTML = gameUtils.fromMsToIntSeconds(this.timer.speedBurst).pad(2);

                        // update the speed penalty timer
                        if (this.timer.trap > 0)
                            document.getElementById("img_playerSpeedSlow").setAttribute("src", "./res/icons/icon_speed_slow.png");
                        else
                            document.getElementById("img_playerSpeedSlow").setAttribute("src", "./res/icons/icon_speed_slow_deactivated.png");
                        document.getElementById("text_playerSpeedSlowTimer").innerHTML = gameUtils.fromMsToIntSeconds(this.timer.trap).pad(2);

                        // update the jail timer
                        if (this.timer.jail > 0)
                            document.getElementById("img_playerJail").setAttribute("src", "./res/icons/icon_jail.png");
                        else
                            document.getElementById("img_playerJail").setAttribute("src", "./res/icons/icon_jail_deactivated.png");
                        document.getElementById("text_playerJailTimer").innerHTML = gameUtils.fromMsToIntSeconds(this.timer.jail).pad(2);

                        break;

                    case gameDefines.PLAYER_SEEKER:
                        // number of traps
                        if (this.noTraps > 0)
                            document.getElementById("img_playerSpecial1").setAttribute("src", "./res/icons/icon_trap.png");
                        else
                            document.getElementById("img_playerSpecial1").setAttribute("src", "./res/icons/icon_trap_deactivated.png");
                        document.getElementById("text_playerSpecial1").innerHTML = Number(this.noTraps).pad(2);
                        break;
                }
                break;
        }
    };

/**
 * draws a game object based on its type
 * @param objectType - type of the object to be drawn
 * @param position - position of the object (top left)
 * @param fogged - true if the object is in the fog
 */
GameClient.prototype.drawObject =
    function (objectType, position, fogged)
    {
        var height = gameDefines.TILE_HEIGHT;
        var width = gameDefines.TILE_WIDTH;

        var drawingPosition = this.getDrawingPosition(position, {x:position.x + gameDefines.TILE_WIDTH, y:position.y + gameDefines.TILE_HEIGHT});

        if (fogged) // draw an empty space first
            this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_EMPTY_FOGGED], drawingPosition.x, drawingPosition.y, width, height);
        else
            this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_EMPTY], drawingPosition.x, drawingPosition.y, width, height);

        switch (objectType)
        {
            case gameDefines.OBJECT_WALL:
                if (fogged)
                    this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_WALL_FOGGED], drawingPosition.x, drawingPosition.y, width, height);
                else
                    this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_WALL], drawingPosition.x, drawingPosition.y, width, height);
                break;
            case gameDefines.OBJECT_CAVE:
                if (!fogged)
                    this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_CAVE], drawingPosition.x, drawingPosition.y, width, height);
                else
                    this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_CAVE_FOGGED], drawingPosition.x, drawingPosition.y, width, height);
                break;
            case gameDefines.OBJECT_TRAP:
                if (!fogged)
                    this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_TRAP], drawingPosition.x, drawingPosition.y, width, height);
                break;
            case gameDefines.OBJECT_GOLD:
                if (fogged)
                {
                    if (this.type == gameDefines.PLAYER_SEEKER) // draw the fogged gold only for the seekers
                        this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_GOLD_FOGGED], drawingPosition.x, drawingPosition.y, width, height);
                }
                else
                    this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_GOLD], drawingPosition.x, drawingPosition.y, width, height);
                break;
            case gameDefines.OBJECT_JAIL:
                this.gContext.background.drawImage(gameResources.images[gameResources.SPRITE_JAIL], drawingPosition.x, drawingPosition.y, width, height);
                break;
            default:
                break;
        }
        /*
        this.gContext.background.fillStyle = 'rgba(0,0,0,0.5)';
        this.gContext.background.fillText(Math.floor(position.x / gameDefines.TILE_WIDTH) + "", drawingPosition.x, drawingPosition.y + 8);
        this.gContext.background.fillText(Math.floor(position.y / gameDefines.TILE_HEIGHT) + "", drawingPosition.x, drawingPosition.y + 16);
        this.gContext.background.fill();
        /**/
    };

/**
 * draws the map
 */
GameClient.prototype.drawMap =
    function()
    {
        var sx = 0;
        var sy = 0;
        // tile corresponding to the player center
        var p_tile = this.gameInstance.getPlayerTile(this);

        /**/
        for (var i = 0; i < this.gameInstance.world.tHeight; i++)
        {
            sx = 0;
            for (var j = 0; j < this.gameInstance.world.tWidth; j++)
            {
                // fog logic

                // reveal the area around this player and the other players of the same type
                var fog = true;

                // tile is around me and i am in the game
                if (this.state == gameDefines.PLAYER_STATE_INGAME || this.state == gameDefines.PLAYER_STATE_JAILED)
                    fog = this.gameInstance.physicsInFog({l:i, c:j}, p_tile);

                // tile is around other players of the same type as mine and they are in the game
                var op = {};
                for (var p = 0; p < this.gameInstance.players.length; p++)
                {
                    op = this.gameInstance.players[p];
                    if (op.type == this.type && op.clientId != this.clientId) // same type and not me
                    {
                        if (fog && (op.state == gameDefines.PLAYER_STATE_INGAME || op.state == gameDefines.PLAYER_STATE_JAILED)) // only if fog not false and the player is in game
                            fog = this.gameInstance.physicsInFog({l:i, c:j}, this.gameInstance.getPlayerTile(op));
                    }
                }

                // even if the players hacks the fog so it doesn't display, the map objects and players are controlled sever side so it makes no difference
                this.drawObject(this.gameInstance.world.tMap[i][j], {x:sx,y:sy}, fog);
                sx += gameDefines.TILE_WIDTH;
            }
            sy += gameDefines.TILE_HEIGHT;
        }
    };

/**
 * draws a player based on his point of view
 * @param player - the player
 * @param pov - the point of view
 */
GameClient.prototype.drawPlayer =
    function(player, pov)
    {
        var drawingPosition = this.getDrawingPosition(player.position, player.position);
        var drawingShadowPosition = this.getDrawingPosition(player.shadowPosition, player.shadowPosition);
        
        switch (pov)
        {
            case gameDefines.POV_ME:
                switch (player.type)
                {
                    case gameDefines.PLAYER_HIDER:
                        switch (player.lastDrawingDirection)
                        {
                            case "l":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_SHADOW_LEFT], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_LEFT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "r":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_SHADOW_RIGHT], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_RIGHT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "u":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_SHADOW_UP], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_UP], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "d":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_SHADOW_DOWN], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_DOWN], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                        }
                        break;
                    case gameDefines.PLAYER_SEEKER:
                        switch (player.lastDrawingDirection)
                        {
                            case "l":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_SHADOW_LEFT], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_LEFT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "r":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_SHADOW_RIGHT], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_RIGHT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "u":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_SHADOW_UP], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_UP], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "d":
                                if (gameDefines.DEBUG_MODE)
                                    this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_SHADOW_DOWN], drawingShadowPosition.x, drawingShadowPosition.y, player.dx, player.dy);
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_DOWN], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                        }
                        break;
                }
                break;
            case gameDefines.POV_FRIEND:
                switch (player.type)
                {
                    case gameDefines.PLAYER_HIDER:
                        switch (player.lastDrawingDirection)
                        {
                            case "l":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_FRIEND_LEFT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "r":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_FRIEND_RIGHT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "u":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_FRIEND_UP], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "d":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_FRIEND_DOWN], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                        }
                        break;
                    case gameDefines.PLAYER_SEEKER:
                        switch (player.lastDrawingDirection)
                        {
                            case "l":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_FRIEND_LEFT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "r":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_FRIEND_RIGHT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "u":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_FRIEND_UP], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "d":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_FRIEND_DOWN], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                        }
                        break;
                }
                break;
            case gameDefines.POV_ENEMY:
                switch (player.type)
                {
                    case gameDefines.PLAYER_HIDER:
                        switch (player.lastDrawingDirection)
                        {
                            case "l":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_ENEMY_LEFT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "r":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_ENEMY_RIGHT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "u":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_ENEMY_UP], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "d":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_HIDER_ENEMY_DOWN], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                        }
                        break;
                    case gameDefines.PLAYER_SEEKER:
                        switch (player.lastDrawingDirection)
                        {
                            case "l":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_ENEMY_LEFT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "r":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_ENEMY_RIGHT], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "u":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_ENEMY_UP], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                            case "d":
                                this.gContext.players.drawImage(gameResources.images[gameResources.SPRITE_SEEKER_ENEMY_DOWN], drawingPosition.x, drawingPosition.y, player.dx, player.dy);
                                break;
                        }
                        break;
                }
                break;
        }
    };

/**
 * draws the other players in the game (no draw for self)
 */
GameClient.prototype.drawPlayers =
    function ()
    {
        var tile = this.gameInstance.getPlayerTile(this);

        var p = {};
        for (var i = 0; i < this.gameInstance.players.length; i++)
        {
            p = this.gameInstance.players[i];
            if (p.clientId == this.clientId) // current player pov - don't draw him
                continue;

            // other players
            switch (p.state)
            {
                case gameDefines.PLAYER_STATE_INGAME: // in game players
                case gameDefines.PLAYER_STATE_JAILED: // in game players
                    if (p.type == this.type) // team mates
                        this.drawPlayer(p, gameDefines.POV_FRIEND);
                    else // enemy
                        this.drawPlayer(p, gameDefines.POV_ENEMY);
                    break;
                default: // any other state don't draw him
                    break;
            }
        }
    };

/**
 * change the mouse cursor for the element
 * @param element - the html element
 * @param cursor - the cursor
 */
GameClient.prototype.changeCursor =
    function (element, cursor)
    {
        element.style.cursor = cursor;
    };

/*********************************************************
 * END DRAWING FUNCTIONS
 * ******************************************************/


  // set the game core and game client classes global
if( 'undefined' != typeof global )
{
    module.exports = global.GameClient = GameClient;
};
