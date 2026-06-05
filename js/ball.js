function Ball() {
  this.reset();
}

Ball.prototype.reset = function () {
  this.x       = NET_X;
  this.y       = GROUND_Y - BALL_RADIUS;
  this.vx      = 0;
  this.vy      = 0;
  this.prevX   = this.x;
  this.prevY   = this.y;
  this.inPlay  = false;
  this.bounces = 0;   // total bounces in current rally (for out-of-bounds detection)
};

// Returns true if a ground bounce happened this frame.
Ball.prototype.update = function (dt) {
  this.prevX = this.x;
  this.prevY = this.y;

  if (!this.inPlay) return false;

  this.vy += GRAVITY * dt;
  this.x  += this.vx * dt;
  this.y  += this.vy * dt;

  var bounced = false;

  if (this.y + BALL_RADIUS >= GROUND_Y) {
    this.y  = GROUND_Y - BALL_RADIUS;
    this.vy = -Math.abs(this.vy) * RESTITUTION;
    this.vx *= FRICTION;
    this.bounces++;
    bounced = true;

    // Kill tiny vertical bounces so ball rolls rather than jitters
    if (Math.abs(this.vy) < 50) {
      this.vy = 0;
    }
  }

  return bounced;
};

// Did the ball cross NET_X this frame, and was it below the net top?
Ball.prototype.crossedNetLow = function () {
  var crossedLeft  = this.prevX <= NET_X && this.x > NET_X;
  var crossedRight = this.prevX >= NET_X && this.x < NET_X;
  if (!crossedLeft && !crossedRight) return false;

  // Interpolate y at crossing
  var t = (NET_X - this.prevX) / (this.x - this.prevX);
  var yAtCross = this.prevY + t * (this.y - this.prevY);
  return yAtCross > NET_TOP_Y;
};

Ball.prototype.draw = function (ctx) {
  if (!this.inPlay) return;

  // Shadow on court
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(this.x, GROUND_Y, BALL_RADIUS * 1.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ball
  ctx.save();
  ctx.beginPath();
  ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_BALL_FILL;
  ctx.fill();
  ctx.strokeStyle = COLOR_BALL_STROKE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
};
