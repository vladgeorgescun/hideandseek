/**
 * unit tests for the Utils class
 * @fileName TestUtils.js
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


exports.fromMsToIntSecondsTestOK =
    function (test)
    {
        try
        {
            var result = gameUtils.fromMsToIntSeconds(-850);
            test.equal(result, 0);

            result = gameUtils.fromMsToIntSeconds(850);
            test.equal(result, 0);

            result = gameUtils.fromMsToIntSeconds(12350);
            test.equal(result, 12);
        }
        catch (ex)
        {
            log.error("fromMsToIntSecondsTestOK " + ex);
            test.ok(false);
        }

        test.done();
    };

exports.containsTileTestOK =
    function (test)
    {
        try
        {
            var tile_list = [{l:0,c:1}, {l:4,c:4}];
            var result = gameUtils.containsTile(tile_list, {l:4,c:4});
            test.equal(result, true);

            result = gameUtils.containsTile(tile_list, {l:4,c:3});
            test.equal(result, false);
        }
        catch (ex)
        {
            log.error("fromMsToIntSecondsTestOK " + ex);
            test.ok(false);
        }

        test.done();
    };