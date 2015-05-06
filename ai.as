/**
 * ai implementation
 * @fileName ai.js
 * @creationDate mai 2013
 * @author vladgeorgescun
 **/

var
    gameDefines = new GameDefines();

/**
 * ai game plaeyr constructor
 * @constructor
 */
var AIGamePlayer =
    function (gameInstance)
    {
        this.gameInstance   = gameInstance;
        this.clientId       = ""; // id of the client in the game
        this.name           = "Unknown";
        this.type           = gameDefines.PLAYER_HIDER;
        this.position       = {x:0, y:0};
        this.lastState      = {position:{x:0, y:0}};// last position state
        this.currentState   = {position:{x:0, y:0}};// current position state
        this.inputs         = [];
        this.inputSequence  = 0;
        this.lastInputSequence  = 0;
        this.dt             = 0.020; // ai players have a 0.020 delta time so it can be divided exactly by the game server update loop
        this.lastDrawingDirection = "u";
        this.state          = gameDefines.PLAYER_STATE_DISCONNECTED;
        this.event          = gameDefines.PLAYER_EVENT_NONE;
        this.dx             = gameDefines.TILE_WIDTH / 2; // client width
        this.dy             = gameDefines.TILE_HEIGHT / 2; // client height
        this.score          = {typeScore:0, timesCaught:0, overallScore:0};
        this.speed          = gameInstance.PLAYER_SPEED;
        this.timer          = {trap:0, cdTrap: 0, speed:0, vision:0, jail:0, cdSpeed:0, speedBurst:0}; // player timers
        this.noTraps        = gameInstance.NO_TRAPS;
        this.isHuman        = false; // true if player is human
    };

/**
 * computes the next movement tile
 */
AIGamePlayer.prototype.computeNextMoveTile =
    function ()
    {

    };

/**
 * returns the data required to move the player with each server update
 * @return Object - the ai 'server' data
 */
AIGamePlayer.prototype.move =
    function ()
    {
        var input = [];
        var ips = Math.floor(gameDefines.SERVER_UPDATE_LOOP / (1000 * this.dt));
        for (var i = 0; i < ips/2; i++)
            input.push('r');

        var data =
        {
            header: gameDefines.MESSAGE_CLIENT_INPUT,
            gameId: this.gameInstance.gameId,
            clientId: this.clientId,
            inputSequence : this.inputSequence,
            dt: this.dt,
            inputs: input
        };

        this.inputSequence += 1;

        return data;
    };

/**
 * 'server' update for the ai player
 * @return Object - the ai 'server' data
 */
AIGamePlayer.prototype.update =
    function (gameInstance)
    {
        this.gameInstance = gameInstance;

        // update my self from the game instance
        for (var i = 0; i < gameInstance.players.length; i++)
        {
            var p = this.gameInstance.players[i];
            if (p.clientId == this.clientId) // update myself
            {
                this.event = p.event;
                this.type = p.type;
                this.state = p.state;
                this.speed = p.speed;
                this.timer = p.timer;
                this.score = p.score;
                this.lastDrawingDirection = p.lastDrawingDirection;
                this.lastState.position = p.currentState.position;
                this.currentState.position = p.currentState.position;
                this.position = p.position;
            }
        }
    };

// set the game core and game client classes global
if( 'undefined' != typeof global )
{
    module.exports = global.AIGamePlayer = AIGamePlayer;
};