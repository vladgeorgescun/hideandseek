/**
 * node.js app.js implementation
 * @fileName app.js
 * @creationDate jan 2013
 * @author vladgeorgescun
 **/

var
    gamePort        = process.env.VCAP_APP_PORT || 3000,
    app             = require('express')(),
    verbose         = false,
    server          = require('http').createServer(app),
    sio             = require('socket.io').listen(server);

// open the server
console.log("\t :: Express :: Listening on port " + gamePort );
server.listen( gamePort );

//By default, we forward the / path to maze.html automatically.
app.get( '/',
    function( req, res )
    {
        res.sendfile( __dirname + '/index.html' );
    });

// treat any requested file
app.get( '/*',
    function( req, res, next )
    {
        //This is the current file they have requested
        var file = req.params[0];
        //For debugging, we can track what files are requested.
        if (verbose)
            console.log('\t :: Express :: file requested : ' + file);
        //Send the requesting client the file.
        res.sendfile( __dirname + '/' + file );
    });

/**
 * socketio configuration
 */
sio.configure(
       function ()
       {
            sio.set('log level', 0);
            sio.set('authorization', function (handshakeData, callback)
                {
                    callback(null, true); // error first callback style
                });
            sio.enable("heartbeats");
            sio.set("heartbeat interval", 5);
        });


// init the server
require("./server.js");
var gameServer = new GameServer();

/**
 * client socket handling
 * @param client - the socket client
 */
sio.sockets.on("connection",
    function (client)
    {
        console.log('\t socket.io:: client requests connection');
        gameServer.onConnect(client);

        // client message handling
        client.on("message",
            function(msg)
            {
                gameServer.onMessage(client, msg);
            });


        // client disconnect

        client.on("disconnectMessage",
            function ()
            {
                console.log("\t socket.io:: disconnectMessage ");
                gameServer.onDisconnect(client);
            });

        // forced socket.io disconnection

        client.on("disconnect",
            function ()
            {
                gameServer.onDisconnect(client);
            });
    });