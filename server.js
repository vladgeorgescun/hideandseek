/**
 * Server implementation
 * @fileName server.js
 * @creationDate jan 2013
 * @author vladgeorgescun
 **/

var
    UUID            = require('node-uuid'),
    log4js          = require('log4js'),
    verbose         = true;

global.window   = global.document = global;

log4js.configure({
    appenders: [
        { type: 'console', category: 'GameServer'},
        { type: 'file', filename: './logs/server.log', category: 'GameServer' }
    ]
});

// import the shared library code
require('./defines.js');
require('./utils.js');
require('./common.js');
require('./ai.as');

var
    gameUtils = new GameUtils(),
    gameDefines = new GameDefines(),
    log = log4js.getLogger('GameServer');

var GameServer =
    function ()
    {
        this.games          = [];
        this.clientCount    = 0;
        this.localTime      = 0;
        this._dt            = new Date().getTime();
        this._dte           = new Date().getTime();
        this._pdt           = new Date().getTime();
        this._pdte          = new Date().getTime();
        this.serverLag      = 100;

        this.init();
    };


/**
 * init function
 */
GameServer.prototype.init =
    function ()
    {
        this.createServerUpdateLoop();
        this.createServerPhysics();
    };

/**
 * sets a loop with a fixed number of execution
 * @param callback - the callback function
 * @param delay - the delay (in ms)
 * @param timeout - the number of executions (in ms)
 */
GameServer.prototype.setTimedInterval =
	function(callback, delay, timeout)
	{
		var id = window.setInterval(callback, delay);
		window.setTimeout(function()
		{
			window.clearInterval(id);
		}, timeout);
	};
/**
 * builds an id for a new player in the game
 * the id is the maximum current player id + 1
 * @return Number - the new id
 */
GameServer.prototype.getNewPlayerId =
    function (game)
    {
        return UUID();
    };

/**
 * gets a game by id
 * @param gameId
 */
GameServer.prototype.getGameById =
    function (gameId)
    {
        for (var g = 0; g < this.games.length; g++)
            if (this.games[g].gameId == gameId)
                return this.games[g];

        return null;
    };

/**
 * builds the update client message for the given player
 * @param game - the game
 * @param player - the player
 */
GameServer.prototype.buildUpdateClientMessage =
    function (game, player)
    {
        var players = []; // the other players as seen by this player

        switch (game.state)
        {
            case gameDefines.GAME_STATE_CREATED:
            case gameDefines.GAME_STATE_OVER:
                // send the players
                for (i = 0; i < game.players.length; i++)
                {
                    var p = game.players[i];
                    players.push(
                        {
                            clientId:p.clientId,
                            name:p.name,
                            type:p.type,
                            state: p.state,
                            score: p.score,
                            isHuman: p.isHuman
                        });
                }
                break;

            case gameDefines.GAME_STATE_RUNNING:
                var player_tile = game.getPlayerTile(player); // tile of the given player

                // init the map
                var map = new Array(game.world.tHeight);
                for (var i = 0; i < game.world.tWidth; i++)
                    map[i] = new Array(game.world.tWidth);

                // compute the map as seen by this player
                for (var i = 0; i < game.world.tHeight; i++)
                {
                    for (var j = 0; j < game.world.tWidth; j++)
                    {
                        map[i][j] = game.world.tMap[i][j];
                        switch (player.type)
                        {
                            case gameDefines.PLAYER_HIDER:
                                switch (game.world.tMap[i][j])
                                {
                                    case gameDefines.OBJECT_TRAP: // don't show traps for hiders
                                        map[i][j] = gameDefines.OBJECT_SPACE;
                                        break;
                                    case gameDefines.OBJECT_GOLD: // TODO: show gold only if in the view area of team - server side
                                        break;
                                }
                                break;
                            case gameDefines.PLAYER_SEEKER:
                                break;
                        }
                    }
                }

                // send the players
                for (i = 0; i < game.players.length; i++)
                {
                    var p = game.players[i];
                    if (p.type == player.type) // my team player (including me)
                    {
                        players.push(
                            {
                                clientId:p.clientId,
                                name:p.name,
                                type:p.type,
                                lastState: {position:p.lastState.position},
                                currentState: {position:p.currentState.position},
                                inputSequence: p.inputSequence,
                                lastInputSequence: p.lastInputSequence,
                                state: p.state,
                                event: p.event,
                                score: p.score,
                                speed: p.speed,
                                timer: p.timer,
                                noTraps: p.noTraps,
                                lastDrawingDirection: p.lastDrawingDirection,
                                isHuman: p.isHuman,
                                fogged: false
                            });
                    }
                    else // enemy player - send it only if it is in my fog range or the fog range of my team players or if its a trapped hider
                    {
                        var fog = true;

                        // enemy is in my range
                        var p_tile = game.getPlayerTile(p);
                        fog = game.physicsInFog(player_tile, p_tile);

                        // enemy is in the range of my in game team mates
                        var op = {};
                        for (var ip = 0; ip < game.players.length; ip++)
                        {
                            op = game.players[ip];

                            if (op.type == player.type && op.clientId != player.clientId) // same type and not me
                            {
                                if (fog) //only if true
                                    fog = game.physicsInFog(game.getPlayerTile(op), p_tile);
                            }
                        }
                        // enemy is a trapped hider
                        if (p.type == gameDefines.PLAYER_HIDER && p.timer.trap > 0)
                            fog = false;

                        if (!fog) // enemy is in vision range of team
                        {
                            players.push(
                                {
                                    clientId:p.clientId,
                                    name:p.name,
                                    type:p.type,
                                    lastState: {position:p.lastState.position},
                                    currentState: {position:p.currentState.position},
                                    inputSequence: p.inputSequence,
                                    lastInputSequence: p.lastInputSequence,
                                    state: p.state,
                                    event:p.event,
                                    score: p.score,
                                    speed: p.speed,
                                    timer: p.timer,
                                    noTraps: p.noTraps,
                                    lastDrawingDirection: p.lastDrawingDirection,
                                    isHuman: p.isHuman,
                                    fogged: false
                                });
                        }
                        else // in fog update without its position and state
                        {
                            players.push(
                                {
                                    clientId:p.clientId,
                                    name:p.name,
                                    type:p.type,
                                    state: p.state,
                                    score: p.score,
                                    speed: p.speed,
                                    timer: p.timer,
                                    isHuman: p.isHuman,
                                    fogged: true
                                });
                        }
                    }
                }
                break;
        }

        var client_message =
        {
            gameId:game.gameId,
            state:game.state,
            serverTime: this.localTime,
            noPlayers: game.players.length,
            world: {tMap:map, tHeight:game.world.tHeight, tWidth:game.world.tWidth},
            timer: game.timer,
            players: players,
            harvestedResources: game.harvestedResources
        };

        return client_message;
    };

/**
 * gets the spawn position by player type (a random cave for hiders and upper right empty space for seekers (tile 1,1) )
 * Required:
 *      tMap(1,1) = OBJECT_EMPTY
 * @param game - the game
 * @param playerType - the player type
 * @returns Object - the upper left coordinates of the spawn position
 */
GameServer.prototype.getPlayerSpawnPosition =
    function (game, playerType)
    {
        switch (playerType)
        {
            case gameDefines.PLAYER_HIDER: // a random cave
                var caves = [];
                for (var i = 0; i < game.world.tHeight; i++)
                {
                    for (var j = 0; j < game.world.tWidth; j++)
                    {
                        if (game.world.tMap[i][j] == gameDefines.OBJECT_CAVE)
                            caves.push({l:i,c:j});
                    }
                }
                var position = Math.floor(Math.random() * caves.length);
                return {x: caves[position].c * gameDefines.TILE_WIDTH + 5, y: caves[position].l * gameDefines.TILE_HEIGHT + 5};
                break;
            case gameDefines.PLAYER_SEEKER: // top left empty space - tMap (1,1)
                return {x: gameDefines.TILE_WIDTH + 5, y:gameDefines.TILE_HEIGHT + 5};
                break;
        }
    };

/**
 * generates and spawns a gold resource on the map (at random empty place not closer than RESOURCE_SPAWN_AREA squares to another resource)
 * @param game - the game instance
 */
GameServer.prototype.spawnResource =
    function(game)
    {
        var possible_spaces = [];
        for (var i = 0; i < game.world.tHeight; i++)
        {
            for (var j = 0; j < game.world.tWidth; j++)
                if (game.world.tMap[i][j] == gameDefines.OBJECT_SPACE)
                    possible_spaces.push({l:i,c:j});
        };
        var valid_area = false;
        var random_position = 0;
        var no_try = 0;
        while (!valid_area && no_try < 1000) // while the position is closer than RESOURCE_SPAWN_AREA to another resource (or 1000 tries have been reached)
        {
            random_position = Math.floor(Math.random() * possible_spaces.length);
            valid_area = true;
            for (i = Math.max((possible_spaces[random_position].l - game.RESOURCE_SPAWN_AREA), 0); i < Math.min((possible_spaces[random_position].l + game.RESOURCE_SPAWN_AREA), game.world.tHeight-1); i++)
                for (j = Math.max((possible_spaces[random_position].c - game.RESOURCE_SPAWN_AREA), 0); j < Math.min((possible_spaces[random_position].c + game.RESOURCE_SPAWN_AREA), game.world.tWidth); j++)
                    if (game.world.tMap[i][j] == gameDefines.OBJECT_GOLD) // another resource found in the area
                        valid_area = false;
            no_try ++;
        }

        game.world.tMap[possible_spaces[random_position].l][possible_spaces[random_position].c] = gameDefines.OBJECT_GOLD;
    };

/**
 * game play - handles the remaining non trivial collisions
 * @param game - the game
 * @param player - the client
 * @param collision - the collision
 */
GameServer.prototype.gpHandleNonTrivialCollision =
    function(game, player, collision)
    {
        // map objects collisions
        if (game.world.tMap[collision.l][collision.c] == collision.element)
        {
            switch (collision.element)
            {
                case gameDefines.OBJECT_GOLD: // hider collides with a gold coin
                    game.world.tMap[collision.l][collision.c] = gameDefines.OBJECT_SPACE;
                    player.score.typeScore += game.SCORE_GOLD_INCREASE;
                    player.score.overallScore += game.SCORE_GOLD_INCREASE;
                    player.event = gameDefines.PLAYER_EVENT_GRABGOLD;
                    game.harvestedResources += 1;

                    if (game.harvestedResources <= (game.TOTAL_GOLD - game.MAP_GOLD) ) // a new resource can be spawned
                        this.spawnResource(game);
                    break;
                case gameDefines.OBJECT_TRAP: // hider collides with a trap
                    game.world.tMap[collision.l][collision.c] = gameDefines.OBJECT_SPACE;
                    player.speed *= game.TRAP_SPEED_PENALTY;
                    player.timer.trap += game.TIMER_TRAP; // adds the trap time
                    player.event = gameDefines.PLAYER_EVENT_TRAPPED;
                    break;
                default:
                    break;
            }
            return;
        }

        // other player collisions
        switch (collision.element)
        {
            case gameDefines.PLAYER_HIDER: // seeker collides with a hider
                // handle the collided hider
                var collided_hider = game.getPlayerById(collision.elementId);
                collided_hider.position = game.getPositionByTile(game.jailTile);
                collided_hider.score.overallScore = Math.max(collided_hider.score.overallScore - game.SCORE_CAUGHT_DECREASE, 0);
                collided_hider.score.timesCaught += 1;
                collided_hider.timer.jail = game.TIMER_JAIL;
                collided_hider.state = gameDefines.PLAYER_STATE_JAILED;

                //console.log("GameCore.prototype.handleNonTrivialCollision caught a hider " + player.clientId + " " + collision.elementId);
                player.score.overallScore += game.SCORE_CATCH_INCREASE;
                player.score.typeScore += 1;
                player.event = gameDefines.PLAYER_EVENT_CATCH;
                break;
            case gameDefines.PLAYER_SEEKER: // hider collides with a seeker

                //console.log("GameCore.prototype.handleNonTrivialCollision was caught by a seeker " + player.clientId  + " " + collision.elementId);
                player.score.overallScore = Math.max(player.score.overallScore - game.SCORE_CAUGHT_DECREASE, 0);
                player.timer.jail = game.TIMER_JAIL;
                player.position = game.getPositionByTile(game.jailTile);
                //player.position = this.getPlayerSpawnPosition(game, player.type);
                player.event = gameDefines.PLAYER_EVENT_CAUGHT;
                player.state = gameDefines.PLAYER_STATE_JAILED;

                // handle the collided seeker
                var collided_seeker = game.getPlayerById(collision.elementId);
                collided_seeker.score.typeScore += 1;
                collided_seeker.score.overallScore += game.SCORE_CATCH_INCREASE;
                break;
            default:
                break;
        }
    };

/**
 * tests that a game is ready to start
 * @param game - the game instance
 */
GameServer.prototype.gpIsGameReady =
    function(game)
    {
        if (!game || game.players.length < 1) // game invalid or not enough players
            return false;

        // are all players ready
        for (var p = 0; p < game.players.length; p++)
            if (game.players[p].state != gameDefines.PLAYER_STATE_READY)
                return false;

        if (gameDefines.DEBUG_MODE) // in debug mode allow only 1 player
            return true;

        // is there at least one hider and one seeker
        var is_hider = false;
        var is_seeker = false;
        for (var p = 0; p < game.players.length; p++)
            if (game.players[p].type == gameDefines.PLAYER_HIDER)
                is_hider = true;
            else
                is_seeker = true;

        if ((!is_hider || !is_seeker) && false)// TODO:remove this
        {
            log.debug("GameServer.gpIsGameReady At least 1 hider & 1 seeker required");
            return false;
        }

        return true;
    };

/**
 * tests that the game is over
 * a game is over if all resources have been harvested (IDEA: OR if all hiders are caught at the same time)
 * @param game - the game instance
 */
GameServer.prototype.gpIsGameOver =
    function(game)
    {
        switch (game.state)
        {
            case gameDefines.GAME_STATE_RUNNING:
                // no more resources to be harvested or game time elapsed
                if (game.harvestedResources >= game.TOTAL_GOLD || game.timer.cdDuration == 0)
                    return true;
                break;
        }

        return false;
    };

/**
 * game play - handles the timers for the game
 * @param game - the game instance
 */
GameServer.prototype.gpHandleGameTimers =
    function (game)
    {
        switch (game.state)
        {
            case gameDefines.GAME_STATE_RUNNING:
                if (game.timer.cdDuration > 0)
                {
                    game.timer.cdDuration -= gameDefines.SERVER_UPDATE_LOOP;
                    if (game.timer.cdDuration < 0) // countdown reached
                        game.timer.cdDuration = 0;
                }
                break;
        }
    };

/**
 * game play - handles the timers for the given player
 * @param game - the game instance
 * @param player - the player
 */
GameServer.prototype.gpHandlePlayerTimers =
    function (game, player)
    {
        switch (player.type)
        {
            case gameDefines.PLAYER_HIDER:
                // speed burst cool down
                if (player.timer.cdSpeed > 0)
                {
                    player.timer.cdSpeed -= gameDefines.SERVER_UPDATE_LOOP;
                    if (player.timer.cdSpeed <= 0) // timer ended remove all the speed penalties and reset the timer
                        player.timer.cdSpeed = 0;
                }

                // speed burst timer
                if (player.timer.speedBurst > 0)
                {
                    player.timer.speedBurst -= gameDefines.SERVER_UPDATE_LOOP;
                    if (player.timer.speedBurst <= 0) // timer ended remove all the speed penalties and reset the timer
                    {
                        player.timer.speedBurst = 0;
                        if (player.speed > game.PLAYER_SPEED) // affected by the speed burst
                            player.speed /= game.BURST_SPEED_FACTOR;

                    }
                }

                // trapped timer
                if (player.timer.trap > 0)
                {
                    player.timer.trap -= gameDefines.SERVER_UPDATE_LOOP;
                    if (player.timer.trap <= 0) // timer ended remove all the speed penalties and reset the timer
                    {
                        player.timer.trap = 0;
                        player.speed = game.PLAYER_SPEED; // reset the speed
                    }
                }

                // jailed timer
                if (player.state == gameDefines.PLAYER_STATE_JAILED)
                {
                    player.timer.jail -= gameDefines.SERVER_UPDATE_LOOP;
                    if (player.timer.jail <= 0) // timer ended - re put the player into the game
                    {
                        player.timer.jail = 0;
                        player.position = this.getPlayerSpawnPosition(game, player.type);
                        player.state = gameDefines.PLAYER_STATE_INGAME;
                    }
                }
                break;
            case gameDefines.PLAYER_SEEKER:
                break;
        }

        return player;
    };

/**
 * broadcasts a message to the players in the game
 * @param game - the game instance
 * @param messageType - type of the message
 * @param message - body of the message
 * @param playerType - the player type or -1 ifsend to all
 */
GameServer.prototype.broadcastMessage =
	function(game, messageType, message, playerType)
	{
		for (var p = 0; p < game.players.length; p++)
            if (game.players[p].isHuman) // only if a human player
            {
                if (playerType == -1)
                    game.players[p].ioSocket.emit(messageType, message);
                else
                {
                    if (game.players[p].type == playerType)
                        game.players[p].ioSocket.emit(messageType, message);
                }
            }
    };

/**
 * server on client connect handler
 * @param client
 */
GameServer.prototype.onConnect =
    function(client)
    {
        log.debug("GameServer.onConnect client connect ");
        this.clientCount += 1;
    };

/**
 * on client disconnect handler
 * @param client - the client
 */
GameServer.prototype.onDisconnect =
    function (client)
    {
        log.debug("GameServer.onDisconnect clientId:" + client.clientId);

        var game = this.getGameById(client.gameId);
        if (!game) // player is not in a game
            return;

        var player = game.getPlayerById(client.clientId);
        if (!player) // player not found
            return;

        this.clientCount -= 1;
        player.state = gameDefines.PLAYER_STATE_CONNECTED; // change state to connected to server
        // remove the player from the player list
        game.players.splice(game.players.indexOf(player), 1);
        log.info("GameServer.onDisconnect player " + player.name + " removed from game " + game.gameId);
        // if no more players in the game end the game
        if (game.players.length == 0)
            this.endGame(game);
        else // send a disconnection chat message to the rest of the players
        {
            var client_packet =
            {
                header: gameDefines.MESSAGE_CLIENT_CHAT,
                gameId: game.gameId,
                playerName: "",
                chatMode: -1,
                chatMessage: player.name + " " + "has left the game" + "!"
            };
            this.broadcastMessage(game, gameDefines.MESSAGE_SERVER_CHAT, client_packet, -1);
        }

    };

/**
 * server client message handler
 * @param client - the client
 * @param data - the data
 */
GameServer.prototype.onMessage =
    function(client, data)
    {
        // game connection required
        switch (data.header)
        {
            case gameDefines.MESSAGE_CLIENT_JOINGAME: // new client wants to join
                log.debug("GameServer.onMessage MESSAGE_CLIENT_JOINGAME " + data.name + " " + data.type);

                var game = this.findGameToJoin();
                if (game == null) // no available game to be joined
                {
                    // create a new game
                    game = this.createGame();
                }
                client.clientId = this.getNewPlayerId(game);
                client.gameId = game.gameId;
                // create the game client and add it to the game
                var game_client = new GamePlayer(game);
                game_client.ioSocket = client;
                game_client.clientId = client.clientId;
                game_client.name = data.name;
                // establishes the type of the player
                log.debug(game.getNoPlayers(gameDefines.PLAYER_HIDER));
                if (game.getNoPlayers(gameDefines.PLAYER_HIDER) < (game.MAX_PLAYERS_PER_GAME / 2)) // add it to the hiders
                    game_client.type = gameDefines.PLAYER_HIDER;
                else
                    game_client.type = gameDefines.PLAYER_SEEKER;

                game_client.state = gameDefines.PLAYER_STATE_PENDING;
                game.players.push(game_client);

                log.debug("GameServer.onMessage added player " + game_client.clientId + " with type " + game_client.type + " to game " + game.gameId);

                // emits the join game message to the client with his id in the selected game
                client.emit(gameDefines.MESSAGE_SERVER_JOINGAME, { clientId : game_client.clientId, gameId: game.gameId});

                break;

            case gameDefines.MESSAGE_CLIENT_CHAT:
                var game = this.getGameById(client.gameId);
                if (!game) // invalid game
                    return;
                this.broadcastMessage(game, gameDefines.MESSAGE_SERVER_CHAT, data, data.chatMode);
                log.debug("GameServer.onMessage MESSAGE_CLIENT_CHAT " + data.playerName + " " + data.chatMessage);
                break;

            case gameDefines.MESSAGE_CLIENT_CHANGETEAM:
                var game = this.getGameById(client.gameId);
                if (!game) // invalid game
                    return;
                var player = game.getPlayerById(client.clientId);
                // change its type if player hasn't pressed ready and not enough players of this type in the game
                if (player.state == gameDefines.PLAYER_STATE_PENDING && game.getNoPlayers(data.type) < Number(game.MAX_PLAYERS_PER_GAME / 2))
                    player.type = data.type;
                break;

            case gameDefines.MESSAGE_CLIENT_STARTGAME: // players says he's ready
                var game = this.getGameById(client.gameId);
                if (!game) // invalid game
                    return;
                var player = game.getPlayerById(client.clientId);
                player.state = gameDefines.PLAYER_STATE_READY;
                // send a chat message
                var client_packet =
                    {
                        header: gameDefines.MESSAGE_CLIENT_CHAT,
                        gameId: game.gameId,
                        playerName: "",
                        chatMode: -1,
                        chatMessage: player.name + " " + "is ready" + "!"
                    };
                this.broadcastMessage(game, gameDefines.MESSAGE_SERVER_CHAT, client_packet, -1);
                log.debug("GameServer.onMessage " + player.clientId + " Ready ");
                break;

            case gameDefines.MESSAGE_CLIENT_INPUT:
                this.onInput(client, data);
                break;

            case gameDefines.MESSAGE_CLIENT_PING:
                // send a response to the client with the server info
                var client_packet =
                    {
                        connectedClients: this.clientCount,
                        runningGames: this.games.length
                    };
                if (gameDefines.SERVER_LAG > 0) // simulated random lag
                {

                    var lag = Math.floor(gameDefines.SERVER_LAG);
                    lag = Math.floor(Math.random() * gameDefines.SERVER_LAG);
                    var clt = client;
                    this.serverLag = lag;
                    setTimeout( function(){clt.emit(gameDefines.MESSAGE_SERVER_PING, client_packet);}, lag);
                }
                else
                    client.emit(gameDefines.MESSAGE_SERVER_PING, client_packet);
                break;
        }
    };

/**
 * game server on client input handler - inputs are treated as they arrive
 * @param client - the client for human players/ the player for AI players
 * @param data - the data { header,gameId,clientId, dt, inputs: {input, lastFrameTime, inputSequence}}
 */
GameServer.prototype.onInput =
    function(client, data)
    {
        var game_id = client.gameId; // for human players don't trust the data gameId for security issues (take the client gameId)
        if (!client.isHuman)
            game_id = data.gameId;

        // process the message
        var game = this.getGameById(game_id);

        if (!game) // game not valid
            return;

        // identify the local player
        var player = game.getPlayerById(data.clientId);
        switch (player.state)
        {
            case gameDefines.PLAYER_STATE_INGAME: // player in game
                // push the data and sort the player inputs by input sequence (as server doesn't necessarily receive packets in the sending order)
                player.inputs.push(data);
                player.inputs = player.inputs.sort(function(a,b)
                {
                    return (a.inputSequence - b.inputSequence);
                });
                break;
            default:
                break;
        }
    };

/**
 * finds a game for the player to join (the first available game)
 * TODO: implement here the matchmaking system by player ranking
 */
GameServer.prototype.findGameToJoin =
    function()
    {
        for (var g = 0; g < this.games.length; g++)
        {
            if (this.games[g].state == gameDefines.GAME_STATE_CREATED && this.games[g].players.length < this.games[g].MAX_PLAYERS_PER_GAME) // return the first non running game with less than max players
                return this.games[g];
        }
        // not a single game available - return null
        return null;
    };

/**
 * create a new game
 */
GameServer.prototype.createGame =
    function()
    {
        // create a new game
        var new_game = new GameCore();
        new_game.gameId = UUID();
        new_game.state = gameDefines.GAME_STATE_CREATED; // game is created
        new_game.timer.cdDuration = new_game.TIMER_GAME_DURATION;
        this.games.push(new_game);

        log.info("GameServer.createGame " + new_game.gameId);
        // TODO: localhack to add an AI player
        /*
        var aiPlayer = new AIGamePlayer(new_game);
        aiPlayer.clientId = this.getNewPlayerId(new_game);
        aiPlayer.name = "Computer 1";
        aiPlayer.type = gameDefines.PLAYER_HIDER;
        aiPlayer.state = gameDefines.PLAYER_STATE_READY;
        new_game.players.push(aiPlayer);
        /**/

        return new_game;
    };

/**
 * starts the game with the countdown
 * @param game - the game instance
 */
GameServer.prototype.startGame =
    function (game)
    {
        var client_packet = {};
        game.state = gameDefines.GAME_STATE_COUNTDOWN;
        game.timer.cdStart = gameDefines.TIMER_GAME_START;
        var srv = this;
        // each second send a countdown chat message
        this.setTimedInterval(
            function()
            {
                // send a chat message
                client_packet =
                {
                    header: gameDefines.MESSAGE_CLIENT_CHAT,
                    gameId: game.gameId,
                    playerName: "",
                    chatMode: -1,
                    chatMessage: "Game starts in " +  (gameUtils.fromMsToIntSeconds(game.timer.cdStart) - 1),
                    countDown: (game.timer.cdStart - 1000)

                };
                game.timer.cdStart = game.timer.cdStart - 1000;
                srv.broadcastMessage(game, gameDefines.MESSAGE_SERVER_CHAT, client_packet, -1);
                //log.debug(game.cdStart);
                // if last countdown start the game
                if (game.timer.cdStart == 1000)
                {
                    // modify the game state and the state of the players

                    for (var p = 0; p < game.players.length; p++) // change the players state and spawn them
                    {
                        game.players[p].state = gameDefines.PLAYER_STATE_INGAME;
                        game.players[p].position = srv.getPlayerSpawnPosition(game, game.players[p].type);
                    }

                    // spawns the initial resources
                    for (var i = 0; i < game.MAP_GOLD; i++)
                        srv.spawnResource(game);

                    // create the cartesian map
                    game.computeCartesianMap();

                    game.state = gameDefines.GAME_STATE_RUNNING;

                    log.info("GameServer.startGame " + game.gameId);
                }
            }, 1000, gameDefines.TIMER_GAME_START);
    };

/**
 * end the given game
 * @param game - the game to end
 */
GameServer.prototype.endGame =
    function(game)
    {
        game.state = gameDefines.GAME_STATE_OVER;
        this.games.splice(this.games.indexOf(game), 1);
        log.info("GameServer.endGame " + game.gameId);
    };

/**
 * server update function
 * sends the clients the new positions and map state
 */
GameServer.prototype.serverUpdate =
    function ()
    {
        // for each game and for each client send an update message with the player positions (including himself)
        // send only for game 0 for now
        var game = {};
        var client_message = {};
        for (var g = this.games.length-1; g >= 0 ; g--)
        {
            game = this.games[g];

            if (game.players == undefined || game.players.length == 0) // no players in the game
                continue;

            this.gpHandleGameTimers(game); // handle the game timers

            // update the server players
            for (var p = 0; p < game.players.length; p++)
            {
                var player = game.players[p];
                // handles the player timers
                this.gpHandlePlayerTimers(game, player);
                // update the player state positions
                player.lastState.position = player.currentState.position;
                player.currentState.position = player.position;
            }

            // build the individual client messages and send them
            var client_messages = []; // list of messages for each client
            for (var p = 0; p < game.players.length; p++)
            {
                var player = game.players[p];
                client_messages[p] = this.buildUpdateClientMessage(game, player);
                player.lastInputSequence = player.inputSequence; // update the last send input sequence
                player.event = gameDefines.PLAYER_EVENT_NONE; // reset any sent event
            }

            // send the messages to each player
            switch (game.state)
            {
                case gameDefines.GAME_STATE_RUNNING:
                    var server = this;
                    if (this.gpIsGameOver(game) ) // game is over
                    {
                        for (var p = 0; p < game.players.length; p++)
                            if (game.players[p].isHuman)
                                game.players[p].ioSocket.emit(gameDefines.MESSAGE_SERVER_GAMEOVER, client_messages[p]);
                    }
                    else // game in progress
                    {

                        for (var p = 0; p < game.players.length; p++)
                            if (!game.players[p].isHuman) // move the ai players
                            {
                                this.onInput(game.players[p], game.players[p].move());
                            }

                        for (var p = 0; p < game.players.length; p++)
                        {
                            if (game.players[p].isHuman)
                            {
                                if (gameDefines.SERVER_LAG > 0) // simulated lag
                                    this.emitDelayed(game.players[p].ioSocket, client_messages[p]);
                                else
                                    game.players[p].ioSocket.emit(gameDefines.MESSAGE_SERVER_UPDATE, client_messages[p]);
                            }
                            else
                                game.players[p].update(game);
                        }
                    }
                    break;
                case gameDefines.GAME_STATE_CREATED:
                    if (this.gpIsGameReady(game)) // game is ready to start
                    {
                        log.debug("GameServer.serverUpdate Game ready and will start " + game.gameId);
                        this.startGame(game);
                    }
                    for (var p = 0; p < game.players.length; p++)
                        if (game.players[p].isHuman)
                            game.players[p].ioSocket.emit(gameDefines.MESSAGE_SERVER_UPDATE, client_messages[p]);
                        else
                            game.players[p].update(game);
                    break;
            }
        }

        // treat the ended games
        for (g = this.games.length-1; g >=0 ; g--)
            if (this.gpIsGameOver(this.games[g]))
                this.endGame(this.games[g]);
    };

GameServer.prototype.emitDelayed =
    function (socket, message)
    {
        setTimeout( function(){socket.emit(gameDefines.MESSAGE_SERVER_UPDATE, message);}, this.serverLag*3);
    };

/**
 * updates the server physics;
 * analyzes the client messages and decides which are valid and which are not
 * returns to each client its assumed position so client can correct
 */
GameServer.prototype.serverUpdatePhysics =
    function()
    {
        // update the client positions based on the input
        // for each game and for each player
        var x_dir = 0;
        var y_dir = 0;
        var special_1 = 0;
        var special_2 = 0;
        var player = [];
        var game = [];
        var resulting_position = {x:0,y:0};

        for (var g = 0; g < this.games.length; g++)
        {
            game = this.games[g];
            for (var p = 0; p < this.games[g].players.length; p++)
            {
                player = this.games[g].players[p];
                resulting_position = player.position;
                if (player.inputs.length > 0) // there are some inputs to be treated
                {
                    for (var i = 0; i < player.inputs.length  ; i++) // for each data input for the player
                    {
						if (player.state == gameDefines.PLAYER_STATE_INGAME) // treat them only if player is in game (as he can be jailed due to a collision)
                        {
                            special_1 = 0;
                            special_2 = 0;
                            if (player.inputs[i].inputs.length > 0 && player.inputs[i].inputs[player.inputs[i].inputs.length-1] != "c" && player.inputs[i].inputs[player.inputs[i].inputs.length-1] != "s") // at least 1 input
                                player.lastDrawingDirection = player.inputs[i].inputs[player.inputs[i].inputs.length-1];

                            for(var j = 0; j < player.inputs[i].inputs.length; j++) // for each key of each input
                            {
                                var key = player.inputs[i].inputs[j];
                                x_dir = 0;
                                y_dir = 0;
                                switch (key)
                                {
                                    case 'l':
                                        x_dir -= 1;
                                        break;
                                    case 'r':
                                        x_dir += 1;
                                        break;
                                    case 'u':
                                        y_dir -= 1;
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
                                    default:
                                        continue;
                                        break;
                                }

                                // a movement input
                                if (x_dir != 0 || y_dir != 0)
                                {
                                    var input_resulting_position = game.v_add( player.position, game.physicsMovementVectorFromDirection(x_dir, y_dir, player.speed, player.inputs[i].dt));
                                    var collisions = game.physicsGetCollisions(player, input_resulting_position); // get the collisions for the input
                                    collisions = game.gpRemoveGameRulesCollisions(player, collisions); // remove the game rules invalid collisions

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
                                                    x_dir += 1;
                                                    break;
                                                case 'r':
                                                    x_dir -= 1;
                                                    break;
                                                case 'u':
                                                    y_dir += 1;
                                                    break;
                                                case 'd':
                                                    y_dir -= 1;
                                                    break;
                                                default:
                                                    break;
                                            }
                                            continue;
                                        }

                                        // non trivial collisions treat them
                                        for(c = collisions.length-1; c >=0; c--)
                                            this.gpHandleNonTrivialCollision(game, player, collisions[c]); // after this the player state can change
                                    }

                                    // update the player position only if he is still in game
                                    if (player.state == gameDefines.PLAYER_STATE_INGAME)
										player.position = input_resulting_position;
                                }
                            }

                            // special 1 input
                            if (special_1 > 0)
                                game.gpHandleSpecial(player);
                        }

                        // modify the treated input sequence
                        player.inputSequence = player.inputs[i].inputSequence;
                    }

                    // remove the treated inputs
                    for (i = player.inputs.length-1; i >= 0; i--)
                        player.inputs.splice(i, 1);
                }
            }
        }
    };


/**
 * server update loop
 */
GameServer.prototype.createServerUpdateLoop =
    function ()
    {
        setInterval(
            function()
            {
                try
                {
                    this._dt = new Date().getTime() - this._dte;
                    this._dte = new Date().getTime();
                    this.localTime += (this._dt/1000.0).fixed();
                    // update server
                    this.serverUpdate();
                }
                catch (err)
                {
                    log.error(err);
                }
            }.bind(this), gameDefines.SERVER_UPDATE_LOOP);
    };

GameServer.prototype.createServerPhysics =
    function ()
    {
        setInterval(
            function()
            {
                try
                {
                    this._pdt = new Date().getTime() - this._dte;
                    this._pdte = new Date().getTime();

                    // update server physics
                    this.serverUpdatePhysics();
                }
                catch (err)
                {
                    log.error(err);
                }

            }.bind(this), gameDefines.SERVER_UPDATE_PHYSICS_LOOP);
    };


// set the game core and game client classes global
if( 'undefined' != typeof global )
{
    module.exports = global.GameServer = GameServer;
};