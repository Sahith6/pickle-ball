// Canvas
var CANVAS_W = 960;
var CANVAS_H = 540;

// Court geometry
var GROUND_Y      = 490;
var COURT_LEFT    = 50;
var COURT_RIGHT   = 910;
var NET_X         = 480;
var NET_HEIGHT    = 70;
var NET_TOP_Y     = GROUND_Y - NET_HEIGHT;   // 420
var KITCHEN_LEFT  = 340;
var KITCHEN_RIGHT = 620;
var HEADER_H      = 50;

// Ball
var BALL_RADIUS = 8;

// Physics
var GRAVITY     = 900;   // px/s²
var RESTITUTION = 0.65;
var FRICTION    = 0.95;

// Paddle
var PADDLE_W = 12;
var PADDLE_H = 70;

// Speeds
var PLAYER_SPEED = 380;   // px/s
var AI_SPEED     = 320;   // px/s

// Hit
var HIT_COOLDOWN     = 0.5;   // seconds
var BASE_HIT_VX      = 450;
var HIT_VX_RANDOM    = 50;
var BASE_HIT_VY      = 350;
var ARC_HIT_VY_RANGE = 250;

// Two-bounce states
var BOUNCE_STATE_RECEIVER = 'RECEIVER_MUST_BOUNCE';
var BOUNCE_STATE_SERVER   = 'SERVER_MUST_BOUNCE';
var BOUNCE_STATE_FREE     = 'FREE';

// Game states
var STATE_MENU      = 'MENU';
var STATE_SERVING   = 'SERVING';
var STATE_PLAYING   = 'PLAYING';
var STATE_GAME_OVER = 'GAME_OVER';

// Scoring
var WINNING_SCORE   = 11;
var WIN_BY          = 2;
var MESSAGE_DURATION = 2.0;   // seconds

// Colors
var COLOR_COURT        = '#4a9c6f';
var COLOR_KITCHEN      = '#3d8a60';
var COLOR_LINE         = '#ffffff';
var COLOR_NET_POST     = '#888888';
var COLOR_NET_MESH     = '#dddddd';
var COLOR_BALL_FILL    = '#f1c40f';
var COLOR_BALL_STROKE  = '#d4a017';
var COLOR_PLAYER_PAD   = '#3498db';
var COLOR_AI_PAD       = '#e74c3c';
var COLOR_HEADER_BG    = 'rgba(0,0,0,0.5)';
var COLOR_MSG_BG       = 'rgba(0,0,0,0.6)';
var COLOR_BG           = '#1a1a2e';
