/**
 * used for client/server defines
 * @fileName defines.js
 * @creationDate avr 2013
 * @author vladgeorgescun
 **/

var GameDefines =
    function ()
    {
        // debug mode - set this to false to disable debug mode
        this.DEBUG_MODE                     = false;
        this.SERVER_LAG                     = 0 // simulate a server lag (random between 100 and this value)

        // client/server loop timers
        this.SERVER_UPDATE_LOOP             = 100;
        this.SERVER_UPDATE_PHYSICS_LOOP     = 45;
        this.CLIENT_UPDATE_PHYSICS_LOOP     = 45;

        // game
        this.MAXIMUM_PREDICT_INPUTS         = 100; // number of maximum prediction inputs until the client world is synced with the server world
        this.TIMER_GAME_START               = 6000; // countdown for the game start - in ms (+1000 in order to touch the 0 timeout interval)
        if (this.DEBUG_MODE)
            this.TIMER_GAME_START = 3000;
        this.PING_INTERVAL                  = 2000; // the client ping interval to the server

        // object tiles dimensions
        this.TILE_WIDTH                     = 40;
        this.TILE_HEIGHT                    = 40;
        this.CANVAS_WIDTH                   = 640;
        this.CANVAS_HEIGHT                  = 400;

        // player point of views
        this.POV_ME                         = 0;
        this.POV_FRIEND                     = 1;
        this.POV_ENEMY                      = 2;

        // player states
        this.PLAYER_STATE_CONNECTED         = 0; // player connected
        this.PLAYER_STATE_PENDING           = 1; // player pending for the game to start
        this.PLAYER_STATE_READY             = 2; // player tells he is ready to start
        this.PLAYER_STATE_INGAME            = 3; // player in game (playing and not jailed)
        this.PLAYER_STATE_CHAT              = 4; // player chats
        this.PLAYER_STATE_DISCONNECTED      = 5; // player disconnected
        this.PLAYER_STATE_JAILED            = 6; // player jailed

        // player events
        this.PLAYER_EVENT_NONE              = 0;
        this.PLAYER_EVENT_GRABGOLD          = 1;
        this.PLAYER_EVENT_RUN               = 2;
        this.PLAYER_EVENT_TRAPPED           = 3;
        this.PLAYER_EVENT_PLANTTRAP         = 4;
        this.PLAYER_EVENT_CATCH             = 5;
        this.PLAYER_EVENT_CAUGHT            = 6;

        // game states
        this.GAME_STATE_CREATED             = 0; // game created
        this.GAME_STATE_COUNTDOWN           = 1; // game ready and in countdown to start
        this.GAME_STATE_RUNNING             = 2; // game running
        this.GAME_STATE_OVER                = 3; // game over

        // server/client message types
        this.MESSAGE_CLIENT_JOINGAME        = 0;
        this.MESSAGE_CLIENT_STARTGAME       = 1;
        this.MESSAGE_CLIENT_CHANGETEAM      = 2;
        this.MESSAGE_CLIENT_CHAT            = 3;
        this.MESSAGE_CLIENT_INPUT           = 4;
        this.MESSAGE_CLIENT_PING            = 5;

        // server messages
        this.MESSAGE_SERVER_CONNECT         = "0";
        this.MESSAGE_SERVER_JOINGAME        = "1";
        this.MESSAGE_SERVER_STARTGAME       = "2";
        this.MESSAGE_SERVER_CHANGETYPE      = "3";
        this.MESSAGE_SERVER_DISCONNECT      = "4";
        this.MESSAGE_SERVER_CHAT            = "5";
        this.MESSAGE_SERVER_UPDATE          = "6";
        this.MESSAGE_SERVER_GAMEOVER        = "7";
        this.MESSAGE_SERVER_PING            = "8";

        // object types
        this.OBJECT_SPACE                   = 0;
        this.OBJECT_WALL                    = 1;
        this.OBJECT_CAVE                    = 2;
        this.OBJECT_TRAP                    = 3;
        this.OBJECT_GOLD                    = 4;
        this.OBJECT_JAIL                    = 5;
        this.OBJECT_LAST                    = 6;
        // player types
        this.PLAYER_HIDER                   = this.OBJECT_LAST + 0;
        this.PLAYER_SEEKER                  = this.OBJECT_LAST + 1;
    };

// set the game core and game client classes global
if( 'undefined' != typeof global )
{
    module.exports = global.GameDefines = GameDefines;
}
