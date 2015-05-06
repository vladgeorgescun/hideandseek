/**
 * used to load and play/show client sound and graphical resources
 * @fileName resources.js
 * @creationDate avr 2013
 * @author vladgeorgescun
 **/

/**
 * class constructor
 * @constructor
 */
var GameResources =
    function()
    {
        // image sources
        this.imageSources = {
            src_space: "./res/sprites/space.png",
            src_space_fogged: "./res/sprites/space_fog.png",
            src_wall: "./res/sprites/wall.png",
            src_wall_fogged: "./res/sprites/wall_fog.png",
            src_cave: "./res/sprites/cave.png",
            src_cave_fogged: "./res/sprites/cave_fog.png",
            src_trap: "./res/sprites/trap.png",
            src_trap_fogged: "./res/sprites/trap_fog.png",
            src_gold: "./res/sprites/gold.png",
            src_gold_fogged: "./res/sprites/gold_fog.png",
            src_hider_u: "./res/sprites/hider_me_u.png",
            src_hider_d: "./res/sprites/hider_me_d.png",
            src_hider_l: "./res/sprites/hider_me_l.png",
            src_hider_r: "./res/sprites/hider_me_r.png",
            src_seeker_u: "./res/sprites/seeker_me_u.png",
            src_seeker_d: "./res/sprites/seeker_me_d.png",
            src_seeker_l: "./res/sprites/seeker_me_l.png",
            src_seeker_r: "./res/sprites/seeker_me_r.png",
            src_hider_friend_u: "./res/sprites/hider_friend_u.png",
            src_hider_friend_d: "./res/sprites/hider_friend_d.png",
            src_hider_friend_l: "./res/sprites/hider_friend_l.png",
            src_hider_friend_r: "./res/sprites/hider_friend_r.png",
            src_hider_enemy_u: "./res/sprites/hider_enemy_u.png",
            src_hider_enemy_d: "./res/sprites/hider_enemy_d.png",
            src_hider_enemy_l: "./res/sprites/hider_enemy_l.png",
            src_hider_enemy_r: "./res/sprites/hider_enemy_r.png",
            src_seeker_friend_u: "./res/sprites/seeker_friend_u.png",
            src_seeker_friend_d: "./res/sprites/seeker_friend_d.png",
            src_seeker_friend_l: "./res/sprites/seeker_friend_l.png",
            src_seeker_friend_r: "./res/sprites/seeker_friend_r.png",
            src_seeker_enemy_u: "./res/sprites/seeker_enemy_u.png",
            src_seeker_enemy_d: "./res/sprites/seeker_enemy_d.png",
            src_seeker_enemy_l: "./res/sprites/seeker_enemy_l.png",
            src_seeker_enemy_r: "./res/sprites/seeker_enemy_r.png",
            src_hider_r_shadow: "./res/sprites/hider_me_r_shadow.png",
            src_hider_l_shadow: "./res/sprites/hider_me_l_shadow.png",
            src_hider_u_shadow: "./res/sprites/hider_me_u_shadow.png",
            src_hider_d_shadow: "./res/sprites/hider_me_d_shadow.png",
            src_seeker_r_shadow: "./res/sprites/seeker_me_r_shadow.png",
            src_seeker_l_shadow: "./res/sprites/seeker_me_l_shadow.png",
            src_seeker_u_shadow: "./res/sprites/seeker_me_u_shadow.png",
            src_seeker_d_shadow: "./res/sprites/seeker_me_d_shadow.png",
            src_jail: "./res/sprites/jail.png"
        }

        this.SPRITE_EMPTY                   = 0;
        this.SPRITE_EMPTY_FOGGED            = 1;
        this.SPRITE_WALL                    = 2;
        this.SPRITE_WALL_FOGGED             = 3;
        this.SPRITE_CAVE                    = 4;
        this.SPRITE_CAVE_FOGGED             = 5;
        this.SPRITE_TRAP                    = 6;
        this.SPRITE_TRAP_FOGGED             = 7;
        this.SPRITE_GOLD                    = 8;
        this.SPRITE_GOLD_FOGGED             = 9;
        this.SPRITE_HIDER_UP                = 10;
        this.SPRITE_HIDER_DOWN              = 11;
        this.SPRITE_HIDER_LEFT             = 12;
        this.SPRITE_HIDER_RIGHT            = 13;
        this.SPRITE_SEEKER_UP               = 14;
        this.SPRITE_SEEKER_DOWN             = 15;
        this.SPRITE_SEEKER_LEFT             = 16;
        this.SPRITE_SEEKER_RIGHT            = 17;
        this.SPRITE_HIDER_FRIEND_UP        = 18;
        this.SPRITE_HIDER_FRIEND_DOWN      = 19;
        this.SPRITE_HIDER_FRIEND_LEFT      = 20;
        this.SPRITE_HIDER_FRIEND_RIGHT     = 21;
        this.SPRITE_HIDER_ENEMY_UP         = 22;
        this.SPRITE_HIDER_ENEMY_DOWN       = 23;
        this.SPRITE_HIDER_ENEMY_LEFT       = 24;
        this.SPRITE_HIDER_ENEMY_RIGHT      = 25;
        this.SPRITE_SEEKER_FRIEND_UP        = 26;
        this.SPRITE_SEEKER_FRIEND_DOWN      = 27;
        this.SPRITE_SEEKER_FRIEND_LEFT      = 28;
        this.SPRITE_SEEKER_FRIEND_RIGHT     = 29;
        this.SPRITE_SEEKER_ENEMY_UP         = 30;
        this.SPRITE_SEEKER_ENEMY_DOWN       = 31;
        this.SPRITE_SEEKER_ENEMY_LEFT       = 32;
        this.SPRITE_SEEKER_ENEMY_RIGHT      = 33;
        this.SPRITE_HIDER_SHADOW_RIGHT      = 34;
        this.SPRITE_HIDER_SHADOW_LEFT       = 35;
        this.SPRITE_HIDER_SHADOW_UP         = 36;
        this.SPRITE_HIDER_SHADOW_DOWN       = 37;
        this.SPRITE_SEEKER_SHADOW_RIGHT     = 38;
        this.SPRITE_SEEKER_SHADOW_LEFT      = 39;
        this.SPRITE_SEEKER_SHADOW_UP        = 40;
        this.SPRITE_SEEKER_SHADOW_DOWN      = 41;
        this.SPRITE_JAIL                    = 42;


        // sound sources
        this.soundSources = {
            src_sound_click: "./res/sounds/click.ogg",
            src_sound_open_door: "./res/sounds/open_door.ogg",
            src_sound_trap: "./res/sounds/trap.ogg",
            src_sound_gold: "./res/sounds/gold.ogg",
            scr_sound_countdown_beep: "./res/sounds/countdown_beep.ogg",
            scr_sound_start_game: "./res/sounds/start_game.ogg"
        }

        this.SOUND_CLICK                    = 0;
        this.SOUND_OPEN_DOOR                = 1;
        this.SOUND_TRAP                     = 2;
        this.SOUND_GOLD                     = 3;
        this.SOUND_COUNTDOWN_BEEP           = 4;
        this.SOUND_START_GAME               = 5;

        // sounds and images variables
        this.sounds = [];
        this.images = [];

        // init them
        this.loadResources();
    };

/**
 * loads the resources
 */
GameResources.prototype.loadResources =
    function()
    {
        try
        {
            // load the images
            this.loadImages(this.imageSources);
            // load the sounds
            this.loadSounds(this.soundSources);
        }
        catch (err)
        {
            alert("ERROR loading resources: " + err);
        }
    };

/*********************************************************
 * SOUNDS
 * ******************************************************/

/**
 * loads the sounds
 * @param sources - sound sources from the constants
 */
GameResources.prototype.loadSounds =
    function(sources)
    {
        var sounds = {};

        for(var src in sources)
        {
            sounds[src] = new Audio(sources[src]);
            sounds[src].onload = this.loadSound(sounds[src]);
        }
    };

/**
 * loads a sound
 * @param sound - the sound to be loaded
 */
GameResources.prototype.loadSound =
    function(sound)
    {
        this.sounds.push(sound);
    };

/**
 * plays the given sound
 * @param soundId - the id of the sound to be played
 */
GameResources.prototype.playSound =
    function(soundId)
    {
        //this.sounds[soundId].stop();
        this.sounds[soundId].currentTime = 0;
        this.sounds[soundId].play();
    };


/*********************************************************
 * IMAGES
 * ******************************************************/

 /**
 * loads the images for displaying
 * @param sources - image sources from the constants
 */
GameResources.prototype.loadImages =
    function(sources)
    {
        var images = {};
        for(var src in sources)
        {
            images[src] = new Image();
            images[src].src = sources[src];
            images[src].onload = this.loadImage(images[src]);
        }
    };

/**
 * loads an image to the game core images
 * @param image - the image to be loaded
 */
GameResources.prototype.loadImage =
    function(image)
    {
        this.images.push(image);
    };