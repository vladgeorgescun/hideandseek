/**
 * Server/client common part implementation
 * @fileName common.js
 * @creationDate jan 2013
 * @author vladgeorgescun
 **/

var
    gameDefines = new GameDefines();

/**
 * server/client common
 * GameCore class used for the representation of 1 game
 * GameCore constructor
 * @constructor
 */
var GameCore =
    function ()
    {
        // game play constants
        this.TIMER_GAME_DURATION            = 300000; // the game countdown - in ms - map dependent
        this.MAX_PLAYERS_PER_GAME           = 10; // the maximum number of players per game - map dependent
        this.TRAP_SPEED_PENALTY             = 0.75; // speed penalty percentage / trap
        this.BURST_SPEED_FACTOR             = 1.5; // speed burst factor
        this.PLAYER_SPEED                   = 75; // initial player speed
        this.NO_TRAPS                       = 5; // initial number of traps for a seeker - map dependent
        this.TIMER_TRAP                     = 10000; // trap time when hitting a trap (for a hider) - in ms
        this.TIMER_JAIL                     = 20000; // jail time for being caught (for a hider) - in ms
        this.TIMER_SPEEDBURST               = 10000; // speed burst duration - in ms
        this.TIMER_SPEEDBURST_CD            = 40000; // speed burst cooldown - in ms
        this.FOG_AREA                       = 3; // number of tiles for the fog
        this.RESOURCE_SPAWN_AREA            = 7; // minimum spawn distance between 2 resources - map dependent
        this.TOTAL_GOLD                     = 20; // total number of gold coins - map dependent
        this.MAP_GOLD                       = 4; // number of gold coins that are on the map at a given time - map dependent
        this.SCORE_GOLD_INCREASE            = 1; // increase of the score when harvesting a gold
        this.SCORE_CATCH_INCREASE           = 1; // increase of the score when catching a hider
        this.SCORE_CAUGHT_DECREASE          = 2; // decrease of the score when caught by a seeker



        // game core variables
        this.gameId         = 0; // game id
        this.world          = { width : 0, height : 0, map: new Array(), tWidth: 0, tHeight:0, tMap: [], tMapChanged: []}; // game world boundaries
        this.jailTile       = {}; // jail tile

        this.players        = [];
        this._pdt           = 0.0001; // The physics update delta time
        this._pdte          = new Date().getTime();  //The physics update last delta time
        this.lastFrameTime  = new Date().getTime();
        this.timer          = {cdStart: 0, cdDuration: 0}; // game countdown timers , game start, game duration

        this.harvestedResources = 0; // number of harvested resources by the hiders
        this.state          = gameDefines.GAME_STATE_CREATED;

        //A local timer for precision on server and client
        this.localTime      = 0.016;            //The local timer
        this._dt            = new Date().getTime();   //The local timer delta
        this._dte           = new Date().getTime();   //The local timer last frame time

        //A list of recent server updates we interpolate across
        this.serverUpdates = [];

        this.serverTime = 0; // time of the server
        this.lastState = {}; // last state of the server

        this.init();
    };

/**
 * inits the world
 */
GameCore.prototype.init =
    function()
    {
        // set a default array position map
        this.world.tMap2 = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,1,1,1,0,1,1,1,0,0,1,1,1,0,1],
            [1,0,0,1,0,0,0,1,1,1,0,0,0,3,0,1],
            [1,0,0,1,1,1,0,1,5,1,2,1,1,1,0,1],
            [1,0,0,1,0,1,0,1,1,1,0,1,1,1,0,1],
            [1,0,1,1,0,1,0,0,0,0,0,1,1,1,0,1],
            [1,0,0,0,0,1,2,1,1,1,3,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];
        this.world.tWidth = 30;
        this.world.tHeight = 20;
        this.world.tMap = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
            [1,0,1,1,1,0,1,1,1,0,1,1,0,0,0,1,1,1,0,1,1,1,1,0,0,0,0,1,0,1],
            [1,0,1,1,1,2,1,1,1,0,0,0,0,0,0,1,1,1,0,1,1,1,1,0,0,0,0,1,0,1],
            [1,0,1,1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1,1,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,1,1,1,0,1,1,1,1,0,0,0,0,0,0,1],
            [1,0,1,1,1,1,0,0,1,0,1,1,1,1,0,1,1,1,0,1,0,0,0,0,1,1,1,1,0,1],
            [1,0,0,0,0,0,0,0,1,0,1,1,1,1,0,1,1,1,0,1,0,1,1,0,1,1,1,1,0,1],
            [1,0,1,1,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,2,0,0,0,1],
            [1,0,1,1,1,1,0,0,1,3,1,1,0,1,1,1,0,0,0,1,1,1,1,1,1,1,0,1,1,1],
            [1,0,1,1,1,1,0,0,1,0,1,1,0,1,5,1,0,0,0,1,0,0,0,0,0,0,0,1,1,1],
            [1,0,0,0,0,0,0,0,1,0,1,1,0,1,1,1,0,0,0,1,1,1,1,1,1,1,0,1,1,1],
            [1,0,1,1,0,1,1,0,1,0,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1],
            [1,0,1,1,1,1,0,0,0,0,0,0,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1],
            [1,0,1,1,1,1,0,1,1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1],
            [1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];

        this.world.width    = this.world.tWidth * gameDefines.TILE_WIDTH;
        this.world.height   = this.world.tHeight * gameDefines.TILE_HEIGHT;
        this.jailTile = this.getTilesByValue(gameDefines.OBJECT_JAIL)[0];

        this.world.tMapChanged = new Array(this.world.tHeight);
        for (var i = 0; i < this.world.tHeight; i++)
            this.world.tMapChanged[i] = new Array(this.world.tWidth);

        for (var i = 0; i < this.world.tHeight; i++)
            for (var j = 0; j < this.world.tWidth; j++)
                this.world.tMapChanged[i][j] = true;
    };

/**
 * server/client common
 * gets the player from a game based on its id
 * @param clientId - id of the player
 * @returns Object - the id of the player or null if player not found
 */
GameCore.prototype.getPlayerById =
    function(clientId)
    {
        for (var i = 0; i < this.players.length; i++)
        {
            if (this.players[i].clientId == clientId) // stop
                return this.players[i];
        }

        return null;
    };

/**
 * gets the number of players of a given type from the game
 * @playerType - type of the player or any other value for all players
 * @return Number - the number of players of the given type or all the players if type doesn't exist
 */
GameCore.prototype.getNoPlayers =
    function(playerType)
    {
        if (playerType != gameDefines.PLAYER_HIDER && playerType != gameDefines.PLAYER_SEEKER)
            return this.players.length;

        var player_count = 0;
        for (var i = 0; i < this.players.length; i++)
            if (this.players[i].type == playerType)
                player_count ++;

        return player_count;
    };

/**
 * server/client common
 * gets the tile corresponding to the player (center)
 * @param player - the player
 * @returns Object - the tile under the form {l,c} or null if player doesn't exist
 */
GameCore.prototype.getPlayerTile =
    function(player)
    {
        if (!player)
            return null;

        return {
            l: Math.floor((player.position.y + player.dy /2) / gameDefines.TILE_HEIGHT),
            c: Math.floor((player.position.x + player.dx /2) / gameDefines.TILE_WIDTH)
            };
    };

/**
 * server/client common
 * gets the the different tiles corresponding to the player 4 corners (ignore the tiles that are the same)
 * @param player - the player
 * @returns Array - the array of different tiles or null if player doesn't exist
 */
GameCore.prototype.getPlayerTiles =
    function(player)
    {
        if (!player)
            return null;

        var result = new Array();
        // push the 4 corners
        result.push({l:Math.floor(player.position.y  / gameDefines.TILE_HEIGHT),c:Math.floor(player.position.x  / gameDefines.TILE_WIDTH)});
        result.push({l:Math.floor(player.position.y  / gameDefines.TILE_HEIGHT),c:Math.floor((player.position.x + player.dx) / gameDefines.TILE_WIDTH)});
        result.push({l:Math.floor((player.position.y + player.dy) / gameDefines.TILE_HEIGHT),c:Math.floor(player.position.x  / gameDefines.TILE_WIDTH)});
        result.push({l:Math.floor((player.position.y + player.dy)  / gameDefines.TILE_HEIGHT),c:Math.floor((player.position.x + player.dx) / gameDefines.TILE_WIDTH)});

        // now delete the similar tiles
        for (var i = result.length-1; i >= 0; i--)
            for (var j = result.length-1; j > i; j--)
            {
                if (result[i].l == result[j].l && result[i].c == result[j].c) // same tile remove it
                    result.splice(i, 1);
            }
        return result;
    };

/**
 * gets the list of tiles which correspond to the given value
 * @param tileValue - the value the tiles must have
 * @return Array - the list of tiles
 */
GameCore.prototype.getTilesByValue =
    function (tileValue)
    {
        var tiles = [];

        for (var i = 0; i < this.world.tHeight; i++)
        {
            for (var j = 0; j < this.world.tWidth; j++)
                if (this.world.tMap[i][j] == tileValue)
                    tiles.push({l:i, c:j});
        }

        return tiles;
    };

/**
 * server/client common
 * gets the tile corresponding to the given position
 * @param position - the cartesian position (x,y)
 * @returns Object - the tile under the form {l,c} or null if position is not valid
 */
GameCore.prototype.getTileByPosition =
    function(position)
    {
        if (!position || !position.x || !position.y)
            return null;

        return {
            l: Math.floor(position.y / gameDefines.TILE_HEIGHT),
            c: Math.floor(position.x / gameDefines.TILE_WIDTH)
        };
    };

/**
 * server/client common
 * gets the cartesian position (center) corresponding to the given tile
 * @param tile - the tile (l,c)
 * @returns Object - the position under the form {x,y} (as center of the tile)
 */
GameCore.prototype.getPositionByTile =
    function(tile)
    {
        if (!tile || !tile.l || !tile.c)
            return null;

        return {
            x: tile.c * gameDefines.TILE_WIDTH + gameDefines.TILE_WIDTH/2,
            y: tile.l * gameDefines.TILE_HEIGHT + gameDefines.TILE_HEIGHT/2
        };
    };

/**
 * server/client common
 * computes the positions of the cartesian map (from the tile map)
 */
GameCore.prototype.computeCartesianMap =
    function()
    {
        var sx = 0;
        var sy = 0;
        this.world.map = []; // clear the cartesian map for recalculation
        this.world.height = this.world.tHeight * gameDefines.TILE_HEIGHT;
        this.world.width = this.world.tWidth * gameDefines.TILE_WIDTH;
        var line = [];
        for (var i = 0; i < this.world.tHeight; i++)
        {
            sx = 0;
            line = [];
            for (var j = 0; j < this.world.tWidth; j++)
            {
                line.push({x:sx,y:sy});
                sx += gameDefines.TILE_WIDTH;
            }
            this.world.map.push(line);
            sy += gameDefines.TILE_HEIGHT;
        }
    };

/**
 * server/client common
 * gets a movement vector from a given direction based on the given mspf
 * @param x - the x direction
 * @param y - the y direction
 * @param speed - the movement speed
 * @param mspf - the milliseconds per frame value for frame rate compensation
 */
GameCore.prototype.physicsMovementVectorFromDirection =
    function(x, y, speed, mspf)
    {
        return {x : (x * (speed * mspf)).fixed(3),
                y : (y * (speed * mspf)).fixed(3)};
    };

/**
 * server/client common
 * tests that two tiles are in fog in rapport with one another
 * @param tile1 - first position
 * @param tile2 - second position
 * @returns Boolean - true if it is in fog
 */
GameCore.prototype.physicsInFog =
    function(tile1, tile2)
    {
        if (Math.abs(tile1.l - tile2.l) <= this.FOG_AREA && Math.abs(tile1.c - tile2.c) <= this.FOG_AREA
            && (Math.abs(tile1.l - tile2.l) + Math.abs(tile1.c - tile2.c)) <= this.FOG_AREA)
            return false;

        return true;
    };

/**
 * server/client common
 * detects if the players next position will collide with other elements of the map
 * @param player - the player
 * @param nextPosition - the next movement vector
 * @return Array - the list of elements (element, l, c) with which the collision is made
 */
GameCore.prototype.physicsGetCollisions =
    function(player, nextPosition)
    {
        var collisions = [];

        try
        {
            // map collisions

            // next position l boundaries (top left, bottom left, top right, bottom right)
            var c_tl = Math.floor(nextPosition.x / gameDefines.TILE_WIDTH);
            var l_tl = Math.floor(nextPosition.y / gameDefines.TILE_HEIGHT);
            var c_tr = Math.floor((nextPosition.x +  player.dx) / gameDefines.TILE_WIDTH);
            var l_tr = Math.floor(nextPosition.y / gameDefines.TILE_HEIGHT);
            var c_bl = Math.floor(nextPosition.x / gameDefines.TILE_WIDTH);
            var l_bl = Math.floor((nextPosition.y + player.dy) / gameDefines.TILE_HEIGHT);
            var c_br = Math.floor((nextPosition.x +  player.dx) / gameDefines.TILE_WIDTH);
            var l_br = Math.floor((nextPosition.y + player.dy) / gameDefines.TILE_HEIGHT);

            // top side
            if (this.world.tMap[l_tl][c_tl] != gameDefines.OBJECT_SPACE && (this.world.map[l_tl][c_tl].y + gameDefines.TILE_HEIGHT) >= nextPosition.y)
                collisions.push({element:this.world.tMap[l_tl][c_tl],l:l_tl,c:c_tl});
            if (this.world.tMap[l_tr][c_tr] != gameDefines.OBJECT_SPACE && (this.world.map[l_tr][c_tr].y + gameDefines.TILE_HEIGHT) >= nextPosition.y)
                collisions.push({element:this.world.tMap[l_tr][c_tr],l:l_tr,c:c_tr});
            // bottom side
            if (this.world.tMap[l_bl][c_bl] != gameDefines.OBJECT_SPACE && this.world.map[l_bl][c_bl].y <= (nextPosition.y + player.dy))
                collisions.push({element:this.world.tMap[l_bl][c_bl],l:l_bl,c:c_bl});
            if (this.world.tMap[l_br][c_br] == gameDefines.OBJECT_WALL && this.world.map[l_br][c_br].y <= (nextPosition.y + player.dy))
                collisions.push({element:this.world.tMap[l_br][c_br],l:l_br,c:c_br});
            // left side
            if (this.world.tMap[l_tl][c_tl] != gameDefines.OBJECT_SPACE && (this.world.map[l_tl][c_tl].x + gameDefines.TILE_WIDTH) >= nextPosition.x)
                collisions.push({element:this.world.tMap[l_tl][c_tl],l:l_tl,c:c_tl});
            if (this.world.tMap[l_bl][c_bl] != gameDefines.OBJECT_SPACE && (this.world.map[l_bl][c_bl].x + gameDefines.TILE_WIDTH) >= nextPosition.x)
                collisions.push({element:this.world.tMap[l_bl][c_bl],l:l_bl,c:c_bl});
            // right side
            if (this.world.tMap[l_tr][c_tr] != gameDefines.OBJECT_SPACE && this.world.map[l_tr][c_tr].x <= (nextPosition.x + player.dx))
                collisions.push({element:this.world.tMap[l_tr][c_tr],l:l_tr,c:c_tr});
            if (this.world.tMap[l_br][c_br] != gameDefines.OBJECT_SPACE && this.world.map[l_br][c_br].x <= (nextPosition.x + player.dx))
                collisions.push({element:this.world.tMap[l_br][c_br],l:l_br,c:c_br});

            // other players collisions
            var corners = {tl:{x:nextPosition.x, y:nextPosition.y}, bl:{x:nextPosition.x, y:nextPosition.y + player.dy},
                tr:{x:nextPosition.x + player.dx, y:nextPosition.y}, br:{x:nextPosition.x + player.dx, y:nextPosition.y + player.dy}};

            for (var i = 0; i < this.players.length; i++) // for each player check the collisions
            {
                var p = this.players[i];

                if (p.clientId != player.clientId ) // not the given player
                {

                    var p_corners = {tl:{x:p.position.x, y:p.position.y}, bl:{x:p.position.x, y:p.position.y + p.dy},
                        tr:{x:p.position.x + p.dx, y:p.position.y}, br:{x:p.position.x+ p.dx, y:p.position.y + p.dy}};

                    // top left corner
                    if (corners.tl.x >= p_corners.tl.x && corners.tl.x <= p_corners.tr.x &&
                        corners.tl.y >= p_corners.tl.y && corners.tl.y <= p_corners.bl.y)
                    {
                        collisions.push({element:p.type,l:0,c:0,elementId:p.clientId});
                        //this.logOnce(this.localTime + ": tl collision with " + p.clientId);
                    }
                    // top right corner
                    if (corners.tr.x >= p_corners.tl.x && corners.tr.x <= p_corners.tr.x &&
                        corners.tr.y >= p_corners.tl.y && corners.tr.y <= p_corners.bl.y)
                    {
                        collisions.push({element:p.type,l:0,c:0,elementId:p.clientId});
                        //this.logOnce(this.localTime + ": tr collision with " + p.clientId);
                    }
                    // bottom left corner
                    if (corners.bl.x >= p_corners.tl.x && corners.bl.x <= p_corners.tr.x &&
                        corners.bl.y >= p_corners.tl.y && corners.bl.y <= p_corners.bl.y)
                    {
                        collisions.push({element:p.type,l:0,c:0,elementId:p.clientId});
                        //this.logOnce(this.localTime + ": bl collision with " + p.clientId);
                    }
                    // bottom right corner
                    if (corners.br.x >= p_corners.tl.x && corners.br.x <= p_corners.tr.x &&
                        corners.br.y >= p_corners.tl.y && corners.br.y <= p_corners.bl.y)
                    {
                        collisions.push({element:p.type,l:0,c:0,elementId:p.clientId});
                        //this.logOnce(this.localTime + ": br collision with " + p.clientId);
                    }

                }
            }
        }
        catch (ex)
        {
            this.logOnce("GameCore.prototype.physicsGetCollisions " + ex + " " + nextPosition.x + " " + nextPosition.y);
        };

        return collisions;
    };


/**
 * return true if a tile is valid for movement (if a player can go there)
 * @param playerType - the player type
 * @param tile - the tile (l,c)
 * @return Boolean - true if the tile is valid (returns false if the player type not found)
 */
GameCore.prototype.isTileMovementValid =
    function(playerType, tile)
    {
        switch (playerType)
        {
            case gameDefines.PLAYER_HIDER:
                if (this.world.tMap[tile.l][tile.c] == gameDefines.OBJECT_WALL || this.world.tMap[tile.l][tile.c] == gameDefines.OBJECT_JAIL)
                    return false;
                break;
            case gameDefines.PLAYER_SEEKER:
                if (this.world.tMap[tile.l][tile.c] == gameDefines.OBJECT_WALL || this.world.tMap[tile.l][tile.c] == gameDefines.OBJECT_CAVE || this.world.tMap[tile.l][tile.c] == gameDefines.OBJECT_JAIL )
                    return false;
                break;
            default:
                return false;
        };

        return true;
    };

/**
 * server/client common
 * game play - removes the game rules collisions for the player
 * @param player - the player for which the collisions are treated
 * @param collisions - the collisions to be handled
 */
GameCore.prototype.gpRemoveGameRulesCollisions =
    function (player, collisions)
    {
        try
        {
            for (var i = collisions.length-1; i >=0 ; i--)
            {
                var collision = collisions[i];
                switch (player.type)
                {
                    case gameDefines.PLAYER_HIDER:
                        if (collision.element == gameDefines.OBJECT_CAVE) // no collision with caves
                            collisions.splice(i,1);
                        if (collision.element == gameDefines.PLAYER_HIDER) // no collision with other hiders
                            collisions.splice(i,1);
                        break;
                    case gameDefines.PLAYER_SEEKER:
                        if (collision.element == gameDefines.OBJECT_GOLD) // no collision with gold resources
                            collisions.splice(i,1);
                        if (collision.element == gameDefines.OBJECT_TRAP) // no collision with traps
                            collisions.splice(i,1);
                        if (collision.element == gameDefines.PLAYER_SEEKER) // no collision with other seekers
                            collisions.splice(i,1);
                        break;
                }
            }
        }
        catch (ex)
        {
            this.logOnce("GameCore.prototype.gpRemoveGameRulesCollisions " + ex);
        }

        return collisions; // returns the new collision array
    };

/**
 * game play - handles the special move from the player (plant trap for seeker and speed burst for hider)
 * @param player - the player
 */
GameCore.prototype.gpHandleSpecial =
    function(player)
    {
        try
        {
            switch (player.type)
            {
                case gameDefines.PLAYER_HIDER:
                    if (player.timer.cdSpeed == 0) // speed cooldown ok
                    {
                        player.timer.cdSpeed = this.TIMER_SPEEDBURST_CD;
                        player.timer.speedBurst = this.TIMER_SPEEDBURST;
                        player.speed *= this.BURST_SPEED_FACTOR;
                        player.event = gameDefines.PLAYER_EVENT_RUN;
                    }
                    break;
                case gameDefines.PLAYER_SEEKER:
                    if (player.noTraps > 0) // traps available
                    {
                        // place the trap to the tile corresponding to the player center
                        var tile = this.getPlayerTile(player);
                        if (this.world.tMap[tile.l][tile.c] == gameDefines.OBJECT_SPACE) // only possible if the space is empty
                        {
                            this.world.tMap[tile.l][tile.c] = gameDefines.OBJECT_TRAP;
                            player.noTraps -= 1;
                            player.event = gameDefines.PLAYER_EVENT_PLANTTRAP;
                        }
                    }
                    break;
            }
        }
        catch (ex)
        {
            this.logOnce("GameCore.prototype.gpHandleSpecial " + ex);
        }
    };

GameCore.prototype.logOnce =
    function(msg)
    {
        document.getElementById("tmp").innerHTML = msg;
    };

GameCore.prototype.log =
    function(msg)
    {
        $("#logMessages").append($('<text/><br/>').text(new Date().getTime() + " " + (msg)));
    };

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
//copies a 2d vector like object from one to another
GameCore.prototype.pos = function(a) { return {x:a.x,y:a.y}; };
//Add a 2d vector with another one and return the resulting vector
GameCore.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };
//Subtract a 2d vector with another one and return the resulting vector
GameCore.prototype.v_sub = function(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; };
//Multiply a 2d vector with a scalar value and return the resulting vector
GameCore.prototype.v_mul_scalar = function(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; };
//For the server, we need to cancel the setTimeout that the polyfill creates
GameCore.prototype.stop_update = function() {  window.cancelAnimationFrame( this.updateid );  };
//Simple linear interpolation
GameCore.prototype.lerp = function(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
//Simple linear interpolation between 2 vectors
GameCore.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };


/*************************************
 * game client part
 *************************************/

/**
 * player constructor used for the other game clients except self
 * @param gameInstance - game instance of the client
 * @constructor
 */
var GamePlayer =
    function (gameInstance)
    {
        this.clientId       = ""; // id of the client in the game
        this.name           = "Unknown";
        this.type           = gameDefines.PLAYER_HIDER;
        this.position       = {x:0, y:0};
        this.shadowPosition  = {x:0, y:0}; // shadow position on the server
        this.lastState      = {position:{x:0, y:0}, povDrawingPosition:{x:0,y:0}};// old position state, the pov drawing position is for the current player pov to ensure smoothness
        this.currentState   = {position:{x:0, y:0}, povDrawingPosition:{x:0,y:0}};// current position state
        this.ioSocket       = {};
        this.inputs         = [];
        this.inputSequence  = 0;
        this.lastInputSequence  = 0;
        this.interpTimeFrame      = 1; // interpolation time frame used to display the other players
        this.dt             = 0.016;
        this.lastDrawingDirection = "u";
        this.state          = gameDefines.PLAYER_STATE_DISCONNECTED;
        this.event          = gameDefines.PLAYER_EVENT_NONE;
        this.dx             = gameDefines.TILE_WIDTH / 2; // client width
        this.dy             = gameDefines.TILE_HEIGHT / 2; // client height
        this.score          = {typeScore:0, timesCaught:0, overallScore:0};
        this.speed          = gameInstance.PLAYER_SPEED;
        this.timer          = {trap:0, cdTrap: 0, speed:0, vision:0, jail:0, cdSpeed:0, speedBurst:0}; // player timers
        this.noTraps        = gameInstance.NO_TRAPS;
        this.isHuman        = true; // true if player is human
    };



// set the game core and game client classes global
if( 'undefined' != typeof global )
{
    module.exports = global.GameCore = GameCore;
    module.exports = global.GamePlayer = GamePlayer;
}

