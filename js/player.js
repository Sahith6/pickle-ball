// side: 0 = human (left), 1 = AI (right)
function Player(side) {
  this.side       = side;
  this.isAI       = (side === 1);
  this.color      = this.isAI ? COLOR_AI_PAD : COLOR_PLAYER_PAD;
  this.speed      = this.isAI ? AI_SPEED : PLAYER_SPEED;
  this.minX       = this.isAI ? NET_X     : COURT_LEFT;
  this.maxX       = this.isAI ? COURT_RIGHT : NET_X;
  this.x          = this.isAI ? 700 : 200;
  this.hitCooldown = 0;
}

Player.prototype.reset = function () {
  this.x           = this.isAI ? 700 : 200;
  this.hitCooldown = 0;
};

// Returns the paddle bounding rect
Player.prototype.paddleRect = function () {
  return {
    left:   this.x - PADDLE_W / 2,
    right:  this.x + PADDLE_W / 2,
    top:    GROUND_Y - PADDLE_H,
    bottom: GROUND_Y
  };
};

// Human update: pass keys object { left: bool, right: bool }
Player.prototype.updateHuman = function (dt, keys) {
  if (keys.left)  this.x -= this.speed * dt;
  if (keys.right) this.x += this.speed * dt;
  this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
  if (this.hitCooldown > 0) this.hitCooldown -= dt;
};

// AI update: intercept or return to defensive position
Player.prototype.updateAI = function (dt, ball) {
  var target;
  if (ball.inPlay && ball.vx > 0) {
    target = ball.x;
  } else {
    target = 700;
  }
  target = Math.max(this.minX, Math.min(this.maxX, target));

  var diff = target - this.x;
  var step = this.speed * dt;
  if (Math.abs(diff) <= step) {
    this.x = target;
  } else {
    this.x += Math.sign(diff) * step;
  }

  if (this.hitCooldown > 0) this.hitCooldown -= dt;
};

// Attempt to hit the ball. Returns true if a hit occurred.
// bounceState: current two-bounce state string
Player.prototype.tryHit = function (ball, bounceState) {
  if (!ball.inPlay)          return false;
  if (this.hitCooldown > 0)  return false;

  var rect = this.paddleRect();
  var bx   = ball.x;
  var by   = ball.y;

  // Ball must overlap the paddle rectangle
  if (bx + BALL_RADIUS < rect.left  ||
      bx - BALL_RADIUS > rect.right ||
      by + BALL_RADIUS < rect.top   ||
      by - BALL_RADIUS > rect.bottom) {
    return false;
  }

  // Ball must be moving toward this paddle
  var movingToward = this.isAI ? (ball.vx > 0) : (ball.vx < 0);
  // Also allow a hit when ball.vx is 0 (served or stationary edge case)
  if (!movingToward && ball.vx !== 0) return false;

  // Volley check: is ball in the air (not a ground-bounced ball)?
  var isVolley = (by < GROUND_Y - BALL_RADIUS - 2);

  // Two-bounce rule enforcement
  if (isVolley) {
    if (this.side === 1 && bounceState === BOUNCE_STATE_RECEIVER) return false;
    if (this.side === 0 && bounceState === BOUNCE_STATE_SERVER)   return false;
  }

  // Kitchen / NVZ volley rule
  if (isVolley) {
    var inKitchen = this.isAI
      ? (this.x >= NET_X && this.x <= KITCHEN_RIGHT)
      : (this.x >= KITCHEN_LEFT && this.x <= NET_X);
    if (inKitchen) return false;
  }

  this.doHit(ball);
  return true;
};

Player.prototype.doHit = function (ball) {
  var direction    = this.isAI ? -1 : 1;
  var distFromNet  = Math.abs(this.x - NET_X);
  var courtHalf    = NET_X - COURT_LEFT;   // 430 px
  var arcFactor    = Math.min(distFromNet / courtHalf, 1);

  ball.vx = direction * (BASE_HIT_VX + (Math.random() * 2 - 1) * HIT_VX_RANDOM);
  ball.vy = -(BASE_HIT_VY + arcFactor * ARC_HIT_VY_RANGE);

  this.hitCooldown = HIT_COOLDOWN;
};

Player.prototype.draw = function (ctx) {
  var rect = this.paddleRect();

  // Arm/body silhouette
  ctx.save();
  ctx.fillStyle = this.color;
  ctx.globalAlpha = 0.4;
  // Simple stick-figure body
  ctx.fillRect(this.x - 6, GROUND_Y - PADDLE_H - 30, 12, 30);
  ctx.globalAlpha = 1.0;

  // Paddle
  ctx.beginPath();
  ctx.roundRect(rect.left, rect.top, PADDLE_W, PADDLE_H, 3);
  ctx.fillStyle = this.color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Paddle grip line
  ctx.beginPath();
  ctx.moveTo(this.x, rect.top + PADDLE_H * 0.65);
  ctx.lineTo(this.x, rect.bottom);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
};
