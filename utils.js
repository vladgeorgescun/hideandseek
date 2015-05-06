/**
 * various utility functions
 * @fileName utils.js
 * @creationDate avr 2013
 * @author vladgeorgescun
 **/

/**
 * class constructor
 * @constructor
 */
var GameUtils =
    function()
    {
    };

/**
 * transforms a ms value to the lowest integer seconds value (e.g. 5999 ms = 5 s) - if negative 0 is given
 * @param msValue - the value in ms
 * @return int - the value in seconds
 */
GameUtils.prototype.fromMsToIntSeconds =
    function (msValue)
    {
        return Math.max(Math.floor(msValue / 1000), 0);
    };


/**
 * returns true if the given tile is found in the tiles
 * @param tiles - an array of tiles
 * @param tile - the given tile (l,c)
 */
GameUtils.prototype.containsTile =
    function (tiles, tile)
    {
        for (var i = 0; i < tiles.length; i++)
            if (tiles[i].l == tile.l && tiles[i].c == tile.c)
                return true;

        return false;
    };

/**
 * gets the manhattan distance between 2 tiles
 * @param sourceTile - the first tile
 * @param destinationTile - the second tile
 */
GameUtils.prototype.getDistanceBetweenTiles =
    function (sourceTile, destinationTile)
    {
        return Math.abs(sourceTile.l - destinationTile.l) + Math.abs(sourceTile.c - destinationTile.c);
    };

/**
 * tests that a given area is in the specified area
 * @param positionTopLeft - top left position of the given area
 * @param positionBottomRight - bottom right position of the given area
 * @param areaTopLeft - top left position of the containing area
 * @param areaBottomRight - bottom right position of the containing area
 * @return Boolean - true if the specified area is in the containing area
 */
GameUtils.prototype.isAreaInArea =
    function (positionTopLeft, positionBottomRight, areaTopLeft, areaBottomRight)
    {
        if (positionTopLeft.x >= areaTopLeft.x && positionTopLeft.x <= areaBottomRight.x &&
            positionTopLeft.y >= areaTopLeft.y && positionTopLeft.y < areaBottomRight.y &&
            positionBottomRight.x >= areaTopLeft.x && positionBottomRight.x <= areaBottomRight.x &&
            positionBottomRight.y >= areaTopLeft.y && positionBottomRight.y < areaBottomRight.y)
            return true;

        return false;
    };

/**
 * pads a number with 0
 * @param nZeros - the number of zeroes to be padded (2 by default)
 * @return string - the padded number
 */
Number.prototype.pad = function(nZeros)
{
    return ('0000000000' + this).slice((nZeros || 2) * -1);
};

if( 'undefined' != typeof global )
{
    module.exports = global.GameUtils = GameUtils;
}
