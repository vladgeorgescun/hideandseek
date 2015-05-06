/**
 * unit tests for the client/server common class
 * @fileName TestCommon.js
 * @creationDate avr 2013
 * @author vladgeorgescun
 **/

require("../defines.js");
require("../utils.js");
require("../common.js");

var log4js          = require('log4js');

log4js.configure({
    appenders: [
        { type: 'console', category: 'TestCommon'},
        { type: 'file', filename: './logs/TestCommon.log', category: 'TestCommon' }
    ]
});

var
    log = log4js.getLogger('TestCommon'),
    gameDefines = new GameDefines(),
    gameUtils = new GameUtils(),
    gameInstance = new GameCore();

// initializer part
function init()
{
    // set a default array position map
    gameInstance.world.tMap = [
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
    gameInstance.world.tWidth = 16;
    gameInstance.world.tHeight = 10;
    gameInstance.world.width    = gameInstance.world.tWidth * gameDefines.TILE_WIDTH;
    gameInstance.world.height   = gameInstance.world.tHeight * gameDefines.TILE_HEIGHT;
    gameInstance.FOG_AREA = 2;

    var player = new GamePlayer(gameInstance);
    player.clientId = 1;
    player.name = "p1";
    player.type = gameDefines.PLAYER_SEEKER;
    player.position = {x:gameDefines.TILE_WIDTH + 5, y:gameDefines.TILE_HEIGHT + 5};
    gameInstance.players.push(player);

    player = new GamePlayer(gameInstance);
    player.clientId = 2;
    player.name = "p2";
    player.type = gameDefines.PLAYER_SEEKER;
    player.position = {x:gameDefines.TILE_WIDTH * 2 - 5, y:gameDefines.TILE_HEIGHT * 4 - 5};
    gameInstance.players.push(player);

    player = new GamePlayer(gameInstance);
    player.clientId = 3;
    player.name = "p3";
    player.type = gameDefines.PLAYER_HIDER;
    gameInstance.players.push(player);

    player = new GamePlayer(gameInstance);
    player.clientId = 4;
    player.name = "p4";
    player.type = gameDefines.PLAYER_HIDER;
    gameInstance.players.push(player);

    player = new GamePlayer(gameInstance);
    player.clientId = 5;
    player.name = "p5";
    player.type = gameDefines.PLAYER_HIDER;
    gameInstance.players.push(player);
}
init();


exports.getPlayerByIdTestOK =
    function (test)
    {
        try
        {
            var player = gameInstance.getPlayerById(0);
            test.equal(player, null);

            player = gameInstance.getPlayerById(1);
            test.notEqual(player, null);
            test.equal(player.name, "p1");
        }
        catch (ex)
        {
            log.error("getPlayerByIdTestOK " + ex);
            test.ok(false);
        }

        test.done();
    };

exports.getNoPlayersTestOK =
    function (test)
    {
        try
        {
            var result = gameInstance.getNoPlayers(gameDefines.PLAYER_HIDER);
            test.equal(result, 3);

            result = gameInstance.getNoPlayers(gameDefines.PLAYER_SEEKER);
            test.equal(result, 2);

            result = gameInstance.getNoPlayers(-1);
            test.equal(result, 5);
        }
        catch (ex)
        {
            log.error("getNoPlayersTestOK " + ex);
            test.ok(false);
        }

        test.done();
    };

exports.getTilesByValueTestOK =
    function (test)
    {
        try
        {
            var tiles = gameInstance.getTilesByValue(gameDefines.OBJECT_JAIL);

            test.equal(tiles.length, 1);
            test.equal(tiles[0].l, 4);
            test.equal(tiles[0].c, 8);

            tiles = gameInstance.getTilesByValue(gameDefines.OBJECT_CAVE);
            test.equal(tiles.length, 2);
            test.equal(tiles[0].l, 4);
            test.equal(tiles[0].c, 10);
            test.equal(tiles[1].l, 7);
            test.equal(tiles[1].c, 6);

            tiles = gameInstance.getTilesByValue(gameDefines.OBJECT_GOLD);
            test.equal(tiles.length, 0);
        }
        catch (ex)
        {
            log.error("getTilesByValueTestOK " + ex);
            test.ok(false);
        }

        test.done();
    };


exports.getPlayerTileTestOK =
    function (test)
    {
        try
        {
            var result = gameInstance.getPlayerTile(gameInstance.getPlayerById(1));
            test.equal(result.l, 1);
            test.equal(result.c, 1);

            var result = gameInstance.getPlayerTile(gameInstance.getPlayerById(2));
            test.equal(result.l, 4);
            test.equal(result.c, 2);

            result = gameInstance.getPlayerTile(gameInstance.getPlayerById(0));
            test.equal(result, null);
        }
        catch (ex)
        {
            log.error("getPlayerTileTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.getPlayerTilesTestOK =
    function (test)
    {
        try
        {
            var result = gameInstance.getPlayerTiles(gameInstance.getPlayerById(1));
            test.equal(result.length, 1);
            test.equal(result[0].l, 1);
            test.equal(result[0].c, 1);

            result = gameInstance.getPlayerTiles(gameInstance.getPlayerById(2));
            test.equal(result.length, 4);
            test.equal(result[0].l, 3);
            test.equal(result[0].c, 1);
            test.equal(result[1].l, 3);
            test.equal(result[1].c, 2);
            test.equal(result[2].l, 4);
            test.equal(result[2].c, 1);
            test.equal(result[3].l, 4);
            test.equal(result[3].c, 2);

            result = gameInstance.getPlayerTiles(gameInstance.getPlayerById(0));
            test.equal(result, null);
        }
        catch (ex)
        {
            log.error("getPlayerTileTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.physicsInFogTestOK =
    function (test)
    {
        try
        {
            var result = gameInstance.physicsInFog({l:1,c:1}, {l:3,c:4});
            test.equal(result, true);

            result = gameInstance.physicsInFog({l:3,c:2}, {l:3,c:4});
            test.equal(result, false);

            result = gameInstance.physicsInFog({l:3,c:2}, {l:3,c:2});
            test.equal(result, false);
        }
        catch (ex)
        {
            log.error("physicsInFogTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.isTileMovementValidTestOK =
    function (test)
    {
        try
        {
            var result = gameInstance.isTileMovementValid(-1, {l:4, c:8});
            test.equal(result, false);

            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_HIDER, {l:4, c:10});
            test.equal(result, true);
            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_SEEKER, {l:4, c:10});
            test.equal(result, false);

            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_HIDER, {l:1, c:1});
            test.equal(result, true);
            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_SEEKER, {l:1, c:1});
            test.equal(result, true);

            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_HIDER, {l:4, c:8});
            test.equal(result, false);
            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_HIDER, {l:4, c:8});
            test.equal(result, false);

            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_HIDER, {l:0, c:0});
            test.equal(result, false);
            result = gameInstance.isTileMovementValid(gameDefines.PLAYER_HIDER, {l:0, c:0});
            test.equal(result, false);
        }
        catch (ex)
        {
            log.error("isTileMovementValidTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.getTileByPositionTestOK =
    function (test)
    {
        try
        {
            var position = {x:gameDefines.TILE_WIDTH + 10, y:gameDefines.TILE_HEIGHT*2 + 10};
            var result = gameInstance.getTileByPosition(position);
            test.equal(result.l, 2);
            test.equal(result.c, 1);

            position = undefined;
            result = gameInstance.getTileByPosition(position);
            test.equal(result, null);
        }
        catch (ex)
        {
            log.error("getTileByPositionTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.getPositionByTileTestOK =
    function (test)
    {
        try
        {
            var tile = {l:1, c:2};
            var result = gameInstance.getPositionByTile(tile);
            test.equal(result.x, gameDefines.TILE_WIDTH*2 + gameDefines.TILE_WIDTH/2);
            test.equal(result.y, gameDefines.TILE_HEIGHT + gameDefines.TILE_HEIGHT/2);

            tile = undefined;
            result = gameInstance.getPositionByTile(tile);
            test.equal(result, null);
        }
        catch (ex)
        {
            log.error("getPositionByTileTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.computeCartesianMapTestOK =
    function (test)
    {
        try
        {
            gameInstance.computeCartesianMap();
            test.equal(gameInstance.world.width, (gameInstance.world.tWidth * gameDefines.TILE_WIDTH));
            test.equal(gameInstance.world.height, gameInstance.world.tHeight * gameDefines.TILE_HEIGHT);
            test.equal(gameInstance.world.map[1][2].x, gameDefines.TILE_WIDTH * 2);
            test.equal(gameInstance.world.map[1][2].y, gameDefines.TILE_HEIGHT * 1);
        }
        catch (ex)
        {
            log.error("computeCartesianMapTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };

exports.physicsGetCollisionsTestOK =
    function (test)
    {
        try
        {
            var position = {x:3*gameDefines.TILE_WIDTH, y:2*gameDefines.TILE_HEIGHT};
            var result = gameInstance.physicsGetCollisions(gameInstance.getPlayerById(1), position);
            test.equal(result.length, 1);
            log.debug(result);
            /*
            test.equal(result[0].element, gameDefines.OBJECT_WALL);
            test.equal(result[0].l, 2);
            test.equal(result[0].c, 3);

            position = {x:1*gameDefines.TILE_WIDTH, x:3*gameDefines.TILE_HEIGHT};
            result = gameInstance.physicsGetCollisions(gameInstance.getPlayerById(1), position);
            test.equal(result.length, 0);
            /**/
        }
        catch (ex)
        {
            log.error("physicsGetCollisionsTestOK " + ex);
            test.ok(false);
        }
        test.done();
    };
