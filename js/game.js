function Game() {
  this.canvas  = document.getElementById('gameCanvas');
  this.ctx     = this.canvas.getContext('2d');

  this.ball    = new Ball();
  this.player  = new Player(0);
  this.ai      = new Player(1);

  this.state   = STATE_MENU;
  this.scores  = [0, 0];
  this.server  = 0;   // 0 = player, 1 = AI

  // Two-bounce state
  this.bounceState = BOUNCE_STATE_FREE;

  // Keys held down
  this.keys = { left: false, right: false };

  // Overlay message
  this.message      = '';
  this.messageTimer = 0;

  // Timer used to detect serve landing zone on first bounce
  this.serveFirstBounce = false;

  // Who hit the ball last (used for fault attribution)
  this.lastHitter = -1;

  // AI serve timer
  this.aiServeTimer = 0;

  this._bindInput();
  this._enterMenu();

  var self = this;
  this._lastTime = null;
  requestAnimationFrame(function (ts) { self._loop(ts); });
}

// ─── Input ───────────────────────────────────────────────────────────────────

Game.prototype._bindInput = function () {
  var self = this;
  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  self.keys.left  = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') self.keys.right = true;
    if (e.code === 'Space') {
      e.preventDefault();
      self._onSpace();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  self.keys.left  = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') self.keys.right = false;
  });
};

Game.prototype._onSpace = function () {
  if (this.state === STATE_MENU) {
    this._startGame();
  } else if (this.state === STATE_SERVING && this.server === 0) {
    this._launchServe();
  } else if (this.state === STATE_GAME_OVER) {
    this._enterMenu();
  }
};

// ─── State transitions ────────────────────────────────────────────────────────

Game.prototype._enterMenu = function () {
  this.state  = STATE_MENU;
  this.scores = [0, 0];
  this.server = 0;
  this.ball.reset();
  this.player.reset();
  this.ai.reset();
};

Game.prototype._startGame = function () {
  this.scores = [0, 0];
  this.server = 0;
  this._enterServing();
};

Game.prototype._enterServing = function () {
  this.state            = STATE_SERVING;
  this.bounceState      = BOUNCE_STATE_FREE;
  this.serveFirstBounce = true;   // next bounce will be the serve landing
  this.lastHitter       = this.server;
  this.message          = '';
  this.messageTimer     = 0;

  // Position the server
  var serverScore = this.scores[this.server];
  var serveRight  = (serverScore % 2 === 0);

  if (this.server === 0) {
    this.player.x = serveRight ? 350 : 150;
    this.ai.x     = 700;
  } else {
    this.ai.x     = serveRight ? 610 : 820;
    this.player.x = 200;
  }

  this.player.hitCooldown = 0;
  this.ai.hitCooldown     = 0;

  // Place ball next to server, resting on ground
  var serverRef = (this.server === 0) ? this.player : this.ai;
  this.ball.reset();
  this.ball.x      = serverRef.x + (this.server === 0 ? 15 : -15);
  this.ball.y      = GROUND_Y - BALL_RADIUS;
  this.ball.inPlay = false;

  // AI auto-serve
  if (this.server === 1) {
    var self = this;
    this.aiServeTimer = setTimeout(function () {
      if (self.state === STATE_SERVING && self.server === 1) {
        self._launchServe();
      }
    }, 1500);
  }
};

Game.prototype._launchServe = function () {
  this.state = STATE_PLAYING;
  this.bounceState = BOUNCE_STATE_RECEIVER;
  this.serveFirstBounce = true;

  var serverScore = this.scores[this.server];
  var serveRight  = (serverScore % 2 === 0);
  var serverRef   = (this.server === 0) ? this.player : this.ai;

  // Direction: player hits right (+vx), AI hits left (-vx)
  var dir     = (this.server === 0) ? 1 : -1;
  var distFromNet = Math.abs(serverRef.x - NET_X);
  var courtHalf   = NET_X - COURT_LEFT;   // 430
  var arcFactor   = Math.min(distFromNet / courtHalf, 1);

  this.ball.x  = serverRef.x + dir * (PADDLE_W / 2 + BALL_RADIUS + 1);
  this.ball.y  = GROUND_Y - BALL_RADIUS;
  this.ball.vx = dir * (BASE_HIT_VX + (Math.random() * 2 - 1) * HIT_VX_RANDOM);
  this.ball.vy = -(BASE_HIT_VY + arcFactor * ARC_HIT_VY_RANGE);
  this.ball.inPlay  = true;
  this.ball.bounces = 0;
  this.lastHitter   = this.server;

  // Give server a brief cooldown so they don't immediately re-hit
  serverRef.hitCooldown = HIT_COOLDOWN;
};

// ─── Main loop ────────────────────────────────────────────────────────────────

Game.prototype._loop = function (timestamp) {
  var self = this;
  if (this._lastTime === null) this._lastTime = timestamp;
  var dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
  this._lastTime = timestamp;

  this._update(dt);
  this._draw();

  requestAnimationFrame(function (ts) { self._loop(ts); });
};

Game.prototype._update = function (dt) {
  if (this.state === STATE_MENU || this.state === STATE_GAME_OVER) return;

  if (this.messageTimer > 0) {
    this.messageTimer -= dt;
    if (this.messageTimer <= 0) {
      this.message = '';
      this._checkGameOver();
    }
    return;
  }

  // Player movement
  this.player.updateHuman(dt, this.keys);

  // AI movement (only when ball is in play)
  if (this.state === STATE_PLAYING) {
    this.ai.updateAI(dt, this.ball);
  }

  if (this.state !== STATE_PLAYING) return;

  // Ball physics
  var bounced = this.ball.update(dt);

  // ── Ground bounce handling ────────────────────────────────────────────────
  if (bounced) {
    var bx = this.ball.x;

    if (this.serveFirstBounce) {
      this.serveFirstBounce = false;
      // Serve must land in opponent's service box (kitchen line → baseline)
      // Opponent of server=0 is right half: x in [KITCHEN_RIGHT..COURT_RIGHT]
      // Opponent of server=1 is left half: x in [COURT_LEFT..KITCHEN_LEFT]
      var validLand;
      if (this.server === 0) {
        validLand = (bx >= KITCHEN_RIGHT && bx <= COURT_RIGHT);
      } else {
        validLand = (bx >= COURT_LEFT && bx <= KITCHEN_LEFT);
      }
      if (!validLand) {
        this._fault(this.server, 'Serve fault!');
        return;
      }
      // Receiver must now bounce — transition: receiver has bounced, server must bounce next
      this.bounceState = BOUNCE_STATE_SERVER;
    } else {
      // Non-serve bounce: advance two-bounce state
      if (this.bounceState === BOUNCE_STATE_RECEIVER) {
        this.bounceState = BOUNCE_STATE_SERVER;
      } else if (this.bounceState === BOUNCE_STATE_SERVER) {
        this.bounceState = BOUNCE_STATE_FREE;
      }
    }

    // Double-bounce (ball bounced twice on same side) = point for other side
    // We detect this by checking which court half the ball is in and
    // whether the ball is clearly not going anywhere useful
    // Simplest approach: if ball bounces and vx has become near-zero or ball
    // went beyond boundary, that's handled by out-of-bounds below.
  }

  // ── Out of bounds ─────────────────────────────────────────────────────────
  // Ball past player's baseline = player failed to return (player's fault).
  // Ball past AI's baseline    = AI failed to return (AI's fault).
  if (this.ball.x < COURT_LEFT) {
    this._fault(0, 'Out!');
    return;
  }
  if (this.ball.x > COURT_RIGHT) {
    this._fault(1, 'Out!');
    return;
  }

  // ── Net fault ─────────────────────────────────────────────────────────────
  if (this.ball.crossedNetLow()) {
    this._fault(this.lastHitter, 'Net!');
    return;
  }

  // ── Ball resting on ground (rally dead — no hit received) ─────────────────
  if (this.ball.inPlay && this.ball.vy === 0 && Math.abs(this.ball.vx) < 20) {
    var restingSide = (this.ball.x < NET_X) ? 0 : 1;
    this._fault(restingSide, restingSide === 0 ? 'Player missed!' : 'AI missed!');
    return;
  }

  // ── Hit detection with explicit violation checks ───────────────────────────
  var pResult = this._checkAndHit(this.player);
  if (pResult !== 'miss') return;

  this._checkAndHit(this.ai);
};

// Returns 'miss' | 'hit' | 'violation'
Game.prototype._checkAndHit = function (player) {
  var ball = this.ball;
  if (!ball.inPlay || player.hitCooldown > 0) return 'miss';

  var rect = player.paddleRect();
  var bx = ball.x, by = ball.y;

  if (bx + BALL_RADIUS < rect.left  || bx - BALL_RADIUS > rect.right ||
      by + BALL_RADIUS < rect.top   || by - BALL_RADIUS > rect.bottom) return 'miss';

  // Ball must be moving toward this player's side (or stationary on serve)
  var movingToward = player.isAI ? (ball.vx > 0) : (ball.vx < 0);
  if (!movingToward && ball.vx !== 0) return 'miss';

  var isVolley = (by < GROUND_Y - BALL_RADIUS - 2);

  if (isVolley) {
    // Two-bounce rule violation
    var twoBounceVio =
      (player.side === 1 && this.bounceState === BOUNCE_STATE_RECEIVER) ||
      (player.side === 0 && this.bounceState === BOUNCE_STATE_SERVER);
    if (twoBounceVio) {
      var who = (player.side === 0) ? 'You volleyed' : 'AI volleyed';
      this._fault(player.side, who + ' before two-bounce rule!');
      return 'violation';
    }

    // Kitchen / NVZ violation
    var inKitchen = player.isAI
      ? (player.x >= NET_X && player.x <= KITCHEN_RIGHT)
      : (player.x >= KITCHEN_LEFT && player.x <= NET_X);
    if (inKitchen) {
      var who = (player.side === 0) ? 'You hit' : 'AI hit';
      this._fault(player.side, who + ' from the Kitchen (NVZ)!');
      return 'violation';
    }
  }

  // Valid hit
  player.doHit(ball);
  this.lastHitter = player.side;
  return 'hit';
};

// ─── Fault / scoring ─────────────────────────────────────────────────────────

// faulter: 0 or 1 (who committed the fault)
Game.prototype._fault = function (faulter, reason) {
  this.ball.inPlay = false;

  var winner = 1 - faulter;   // other side wins the rally

  if (this.server === winner) {
    // Server won → score
    this.scores[winner]++;
    this.message = (winner === 0 ? 'Player' : 'AI') + ' scores! ' + reason;
  } else {
    // Receiver won → sideout
    this.server = winner;
    this.message = (winner === 0 ? 'Player' : 'AI') + ' wins rally! ' + reason;
  }

  this.messageTimer = MESSAGE_DURATION;
};

Game.prototype._checkGameOver = function () {
  var p = this.scores[0];
  var a = this.scores[1];
  if ((p >= WINNING_SCORE || a >= WINNING_SCORE) && Math.abs(p - a) >= WIN_BY) {
    this.state   = STATE_GAME_OVER;
    this.message = p > a ? 'Player Wins!' : 'AI Wins!';
  } else {
    this._enterServing();
  }
};

// ─── Drawing ──────────────────────────────────────────────────────────────────

Game.prototype._draw = function () {
  var ctx = this.ctx;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (this.state === STATE_MENU) {
    this._drawMenu();
    return;
  }

  this._drawCourt();
  this._drawNet();
  this.ball.draw(ctx);
  // Draw ball in hand during serving
  if (this.state === STATE_SERVING) {
    this._drawHeldBall();
  }
  this.player.draw(ctx);
  this.ai.draw(ctx);
  this._drawHeader();
  this._drawMessage();

  if (this.state === STATE_GAME_OVER) {
    this._drawGameOver();
  }
};

Game.prototype._drawCourt = function () {
  var ctx = this.ctx;

  // Background
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Court surface
  ctx.fillStyle = COLOR_COURT;
  ctx.fillRect(COURT_LEFT, GROUND_Y, COURT_RIGHT - COURT_LEFT, CANVAS_H - GROUND_Y);

  // Court surface top strip (below ball level to ground)
  ctx.fillRect(COURT_LEFT, HEADER_H, COURT_RIGHT - COURT_LEFT, GROUND_Y - HEADER_H);

  // Kitchen zones (darker)
  ctx.fillStyle = COLOR_KITCHEN;
  ctx.fillRect(KITCHEN_LEFT, HEADER_H, NET_X - KITCHEN_LEFT, GROUND_Y - HEADER_H);
  ctx.fillRect(NET_X, HEADER_H, KITCHEN_RIGHT - NET_X, GROUND_Y - HEADER_H);

  // Baseline & sidelines
  ctx.strokeStyle = COLOR_LINE;
  ctx.lineWidth   = 2;

  // Left baseline
  ctx.beginPath();
  ctx.moveTo(COURT_LEFT, HEADER_H);
  ctx.lineTo(COURT_LEFT, GROUND_Y);
  ctx.stroke();

  // Right baseline
  ctx.beginPath();
  ctx.moveTo(COURT_RIGHT, HEADER_H);
  ctx.lineTo(COURT_RIGHT, GROUND_Y);
  ctx.stroke();

  // Ground line
  ctx.beginPath();
  ctx.moveTo(COURT_LEFT, GROUND_Y);
  ctx.lineTo(COURT_RIGHT, GROUND_Y);
  ctx.stroke();

  // Kitchen lines
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(KITCHEN_LEFT, GROUND_Y);
  ctx.lineTo(KITCHEN_LEFT, HEADER_H);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(KITCHEN_RIGHT, GROUND_Y);
  ctx.lineTo(KITCHEN_RIGHT, HEADER_H);
  ctx.stroke();

  // Kitchen / NVZ labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('NVZ', (KITCHEN_LEFT + NET_X) / 2, GROUND_Y - 8);
  ctx.fillText('NVZ', (NET_X + KITCHEN_RIGHT) / 2, GROUND_Y - 8);
};

Game.prototype._drawNet = function () {
  var ctx = this.ctx;

  // Post
  ctx.fillStyle = COLOR_NET_POST;
  ctx.fillRect(NET_X - 4, NET_TOP_Y, 8, NET_HEIGHT);

  // Mesh lines (horizontal)
  ctx.strokeStyle = COLOR_NET_MESH;
  ctx.lineWidth   = 1;
  var meshLines = 5;
  for (var i = 0; i <= meshLines; i++) {
    var ny = NET_TOP_Y + (NET_HEIGHT / meshLines) * i;
    ctx.beginPath();
    ctx.moveTo(NET_X - 4, ny);
    ctx.lineTo(NET_X + 4, ny);
    ctx.stroke();
  }

  // Top tape (white band)
  ctx.fillStyle = '#fff';
  ctx.fillRect(NET_X - 5, NET_TOP_Y, 10, 4);
};

Game.prototype._drawHeldBall = function () {
  var ctx  = this.ctx;
  var ref  = (this.server === 0) ? this.player : this.ai;
  var bx   = ref.x + (this.server === 0 ? 15 : -15);
  var by   = GROUND_Y - BALL_RADIUS;

  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_BALL_FILL;
  ctx.fill();
  ctx.strokeStyle = COLOR_BALL_STROKE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
};

Game.prototype._drawHeader = function () {
  var ctx = this.ctx;

  // Background bar
  ctx.fillStyle = COLOR_HEADER_BG;
  ctx.fillRect(0, 0, CANVAS_W, HEADER_H);

  // Scores
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(this.scores[0], CANVAS_W / 2 - 60, HEADER_H / 2);
  ctx.fillText('–', CANVAS_W / 2, HEADER_H / 2);
  ctx.fillText(this.scores[1], CANVAS_W / 2 + 60, HEADER_H / 2);

  // Player labels
  ctx.font = '12px Arial';
  ctx.fillStyle = COLOR_PLAYER_PAD;
  ctx.textAlign = 'right';
  ctx.fillText('PLAYER', CANVAS_W / 2 - 70, HEADER_H / 2);

  ctx.fillStyle = COLOR_AI_PAD;
  ctx.textAlign = 'left';
  ctx.fillText('AI', CANVAS_W / 2 + 70, HEADER_H / 2);

  // Serve indicator
  ctx.fillStyle = '#f1c40f';
  ctx.font      = '11px Arial';
  ctx.textAlign = 'center';
  var servingLabel = (this.server === 0) ? '◄ Serving' : 'Serving ►';
  ctx.fillText(servingLabel, CANVAS_W / 2, HEADER_H - 8);

  // Bounce state hint
  if (this.state === STATE_PLAYING) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(this.bounceState.replace(/_/g, ' '), 6, 14);
  }
};

Game.prototype._drawMessage = function () {
  if (!this.message || this.state === STATE_GAME_OVER) return;

  var ctx = this.ctx;
  ctx.save();
  ctx.fillStyle = COLOR_MSG_BG;
  ctx.fillRect(0, CANVAS_H / 2 - 36, CANVAS_W, 72);
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 30px Arial';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this.message, CANVAS_W / 2, CANVAS_H / 2);
  ctx.restore();
};

Game.prototype._drawMenu = function () {
  var ctx = this.ctx;

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Title
  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 56px Arial';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PICKLEBALL', CANVAS_W / 2, 160);

  // Subtitle
  ctx.fillStyle = '#aaa';
  ctx.font      = '20px Arial';
  ctx.fillText('Side-view · 1 Player vs AI', CANVAS_W / 2, 215);

  // Controls box
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.roundRect(CANVAS_W / 2 - 200, 260, 400, 180, 10);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 15px Arial';
  ctx.fillText('CONTROLS', CANVAS_W / 2, 285);

  ctx.font      = '14px Arial';
  ctx.fillStyle = '#ccc';
  var lines = [
    'A / ← — Move left',
    'D / → — Move right',
    'Space — Serve',
  ];
  lines.forEach(function (line, i) {
    ctx.fillText(line, CANVAS_W / 2, 315 + i * 28);
  });

  // Rules summary
  ctx.fillStyle = '#aaa';
  ctx.font      = '13px Arial';
  ctx.fillText('Two-bounce rule · Kitchen/NVZ · Traditional scoring · First to 11', CANVAS_W / 2, 415);

  // Start prompt (pulsing)
  var pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillStyle = 'rgba(241,196,15,' + pulse + ')';
  ctx.font      = 'bold 22px Arial';
  ctx.fillText('Press SPACE to Start', CANVAS_W / 2, 465);
};

Game.prototype._drawGameOver = function () {
  var ctx = this.ctx;

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 54px Arial';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this.message, CANVAS_W / 2, CANVAS_H / 2 - 40);

  ctx.fillStyle = '#fff';
  ctx.font      = '24px Arial';
  ctx.fillText(this.scores[0] + ' – ' + this.scores[1], CANVAS_W / 2, CANVAS_H / 2 + 20);

  var pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillStyle = 'rgba(255,255,255,' + pulse + ')';
  ctx.font      = '18px Arial';
  ctx.fillText('Press SPACE to return to menu', CANVAS_W / 2, CANVAS_H / 2 + 70);
};

// Kick off the game
new Game();
