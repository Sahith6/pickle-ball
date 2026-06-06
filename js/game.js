// ============================================================
//  Pickleball 3D  —  game.js
//  Full Three.js implementation: court, physics, AI, input
// ============================================================

/* ---- Court / physics constants ---- */
var HALF_LEN     = 11;
var HALF_W       = 5;
var NET_H        = 1.5;
var KIT_D        = 3.5;
var BALL_R       = 0.12;
var GRAVITY      = 9.8;
var BOUNCE_REST  = 0.6;
var HIT_RANGE_XZ = 1.8;
var HIT_RANGE_Y  = 1.8;
var WIN_SCORE    = 11;
var WIN_BY       = 2;

/* ---- Difficulty presets ---- */
var DIFFICULTY = {
  easy:   { speed: 2.8, accuracy: 1.8, reactionDelay: 0.5  },
  medium: { speed: 5.0, accuracy: 0.6, reactionDelay: 0.18 },
  hard:   { speed: 7.5, accuracy: 0.15, reactionDelay: 0.0 }
};

/* ============================================================
   Game class
   ============================================================ */
function Game(charIdx, difficulty) {
  this.charIdx    = charIdx;
  this.difficulty = difficulty;
  this.aiSettings = DIFFICULTY[difficulty] || DIFFICULTY.medium;

  /* ---- renderer ---- */
  var canvas = document.getElementById('gameCanvas');
  this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  this.renderer.setSize(window.innerWidth, window.innerHeight);

  /* ---- scene & camera ---- */
  this.scene  = new THREE.Scene();
  this.scene.background = new THREE.Color(0x0a0a1a);

  this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 300);
  this.camera.position.set(0, 13, 22);
  this.camera.lookAt(0, 2, 0);

  /* ---- state ---- */
  this.scores        = [0, 0];
  this.server        = 0;
  this.state         = 'SERVING';
  this.bounceState   = 'FREE';
  this.lastHitter    = 0;
  this.serveFirstBounce = true;
  this.aiReactionTimer  = 0;

  this.ball = {
    x: 0, y: BALL_R, z: 9,
    vx: 0, vy: 0, vz: 0,
    inPlay: false,
    hitCooldown: 0
  };

  this.playerPos = { x: 0, z: 9 };
  this.aiPos     = { x: 0, z: -9 };

  /* ---- input ---- */
  this.keys     = {};
  this.joystick = { x: 0, z: 0 };

  /* ---- build world ---- */
  this._buildLighting();
  this._buildCourt();
  this._buildNet();
  this._buildEnvironment();
  this._buildBall();
  this._buildCharacters();

  /* ---- bind controls ---- */
  this._bindInput();
  this._bindTouchControls();

  /* ---- start ---- */
  this._setupServe();
  this._updateHUD();

  /* show HUD */
  document.getElementById('hud').style.display = 'flex';

  /* ---- animation loop ---- */
  this._lastTime = null;
  this._boundLoop = this._loop.bind(this);
  requestAnimationFrame(this._boundLoop);
}

/* ============================================================
   WORLD BUILDING
   ============================================================ */

Game.prototype._buildLighting = function () {
  var ambient = new THREE.AmbientLight(0xffffff, 0.5);
  this.scene.add(ambient);

  var dirLight = new THREE.DirectionalLight(0xfffbee, 1.3);
  dirLight.position.set(8, 20, 15);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 100;
  dirLight.shadow.camera.left   = -20;
  dirLight.shadow.camera.right  =  20;
  dirLight.shadow.camera.top    =  25;
  dirLight.shadow.camera.bottom = -25;
  this.scene.add(dirLight);
};

Game.prototype._buildCourt = function () {
  /* Main court surface */
  var courtGeo = new THREE.PlaneGeometry(HALF_W * 2, HALF_LEN * 2);
  var courtMat = new THREE.MeshPhongMaterial({ color: 0x2E86AB });
  var court = new THREE.Mesh(courtGeo, courtMat);
  court.rotation.x = -Math.PI / 2;
  court.receiveShadow = true;
  this.scene.add(court);

  /* Kitchen zones */
  var kitMat = new THREE.MeshPhongMaterial({ color: 0x1A6A8A });
  var kitGeo = new THREE.PlaneGeometry(HALF_W * 2, KIT_D);

  var kitPlayer = new THREE.Mesh(kitGeo, kitMat);
  kitPlayer.rotation.x = -Math.PI / 2;
  kitPlayer.position.set(0, 0.01, KIT_D / 2);
  kitPlayer.receiveShadow = true;
  this.scene.add(kitPlayer);

  var kitAI = new THREE.Mesh(kitGeo, kitMat);
  kitAI.rotation.x = -Math.PI / 2;
  kitAI.position.set(0, 0.01, -KIT_D / 2);
  kitAI.receiveShadow = true;
  this.scene.add(kitAI);

  /* Ground beyond court */
  var groundGeo = new THREE.PlaneGeometry(80, 80);
  var groundMat = new THREE.MeshPhongMaterial({ color: 0x1a3a1a });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  this.scene.add(ground);

  /* Court lines */
  this._buildCourtLines();
};

Game.prototype._buildCourtLines = function () {
  var lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

  function line(pts) {
    var geo = new THREE.BufferGeometry().setFromPoints(pts.map(function (p) {
      return new THREE.Vector3(p[0], 0.02, p[1]);
    }));
    return new THREE.Line(geo, lineMat);
  }

  var HW = HALF_W, HL = HALF_LEN, KD = KIT_D;

  /* Outer rectangle */
  var outer = [
    [-HW, -HL], [ HW, -HL],
    [ HW,  HL], [-HW,  HL],
    [-HW, -HL]
  ];
  this.scene.add(line(outer));

  /* Kitchen lines */
  this.scene.add(line([[-HW, KD], [HW, KD]]));
  this.scene.add(line([[-HW, -KD], [HW, -KD]]));

  /* Center service line */
  this.scene.add(line([[0, -KD], [0, KD]]));

  /* Net line */
  this.scene.add(line([[-HW, 0], [HW, 0]]));
};

Game.prototype._buildNet = function () {
  var postMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
  var postGeo = new THREE.CylinderGeometry(0.06, 0.06, NET_H, 8);

  var leftPost  = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-HALF_W, NET_H / 2, 0);
  leftPost.castShadow = true;
  this.scene.add(leftPost);

  var rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(HALF_W, NET_H / 2, 0);
  rightPost.castShadow = true;
  this.scene.add(rightPost);

  /* Net grid lines */
  var netMat = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 });

  /* 8 vertical lines */
  var verticals = 8;
  for (var i = 0; i <= verticals; i++) {
    var xPos = -HALF_W + (HALF_W * 2) * (i / verticals);
    var vGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xPos, 0,     0),
      new THREE.Vector3(xPos, NET_H, 0)
    ]);
    this.scene.add(new THREE.Line(vGeo, netMat));
  }

  /* 5 horizontal lines */
  for (var j = 0; j <= 4; j++) {
    var yPos = (NET_H * j) / 4;
    var hGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-HALF_W, yPos, 0),
      new THREE.Vector3( HALF_W, yPos, 0)
    ]);
    this.scene.add(new THREE.Line(hGeo, netMat));
  }

  /* White tape at top */
  var tapeGeo = new THREE.BoxGeometry(HALF_W * 2, 0.06, 0.04);
  var tapeMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
  var tape = new THREE.Mesh(tapeGeo, tapeMat);
  tape.position.set(0, NET_H, 0);
  this.scene.add(tape);
};

Game.prototype._buildEnvironment = function () {
  var standMat = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });

  /* Left stand */
  var leftStand = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 25), standMat);
  leftStand.position.set(-8, 2.5, 0);
  leftStand.receiveShadow = true;
  this.scene.add(leftStand);

  /* Right stand */
  var rightStand = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 25), standMat);
  rightStand.position.set(8, 2.5, 0);
  rightStand.receiveShadow = true;
  this.scene.add(rightStand);

  /* Back wall behind AI */
  var backWallMat = new THREE.MeshPhongMaterial({ color: 0x34495e });
  var backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 2), backWallMat);
  backWall.position.set(0, 4, -14);
  backWall.receiveShadow = true;
  this.scene.add(backWall);

  /* Ground plane beyond court */
  var farGround = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshPhongMaterial({ color: 0x1a2e1a })
  );
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = -0.05;
  this.scene.add(farGround);
};

Game.prototype._buildBall = function () {
  var ballGeo = new THREE.SphereGeometry(BALL_R, 12, 8);
  var ballMat = new THREE.MeshPhongMaterial({ color: 0xf5e642 });
  this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
  this.ballMesh.castShadow = true;
  this.scene.add(this.ballMesh);

  /* Shadow disc */
  var shadowGeo = new THREE.CircleGeometry(0.15, 12);
  var shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  this.ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
  this.ballShadow.rotation.x = -Math.PI / 2;
  this.ballShadow.position.y = 0.01;
  this.scene.add(this.ballShadow);
};

Game.prototype._buildCharacters = function () {
  var playerCfg = CHARACTERS[this.charIdx];
  this.playerMesh = createCharacter(playerCfg, false);
  this.playerMesh.position.set(this.playerPos.x, 0, this.playerPos.z);
  this.scene.add(this.playerMesh);

  var aiCfgIdx = (this.charIdx + 1) % 4;
  var aiCfg    = CHARACTERS[aiCfgIdx];
  this.aiMesh  = createCharacter(aiCfg, true);
  this.aiMesh.position.set(this.aiPos.x, 0, this.aiPos.z);
  this.scene.add(this.aiMesh);
};

/* ============================================================
   INPUT
   ============================================================ */

Game.prototype._bindInput = function () {
  var self = this;

  this._onKeyDown = function (e) {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': self.keys.left  = true; break;
      case 'ArrowRight': case 'KeyD': self.keys.right = true; break;
      case 'ArrowUp':    case 'KeyW': self.keys.up    = true; break;
      case 'ArrowDown':  case 'KeyS': self.keys.down  = true; break;
      case 'Space': e.preventDefault(); self._onHit(); break;
    }
  };

  this._onKeyUp = function (e) {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': self.keys.left  = false; break;
      case 'ArrowRight': case 'KeyD': self.keys.right = false; break;
      case 'ArrowUp':    case 'KeyW': self.keys.up    = false; break;
      case 'ArrowDown':  case 'KeyS': self.keys.down  = false; break;
    }
  };

  this._onResizeBound = this._onResize.bind(this);

  window.addEventListener('keydown', this._onKeyDown);
  window.addEventListener('keyup',   this._onKeyUp);
  window.addEventListener('resize',  this._onResizeBound);
};

Game.prototype._bindTouchControls = function () {
  var self = this;
  var stickZone = document.getElementById('stick-zone');
  var stickBase = document.getElementById('stick-base');
  var stickNub  = document.getElementById('stick-nub');
  var hitBtn    = document.getElementById('hit-btn');

  var startX = 0, startY = 0;

  stickZone.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var rect = stickZone.getBoundingClientRect();
    startX = t.clientX - rect.left;
    startY = t.clientY - rect.top;

    stickBase.style.display = 'flex';
    stickBase.style.left = (startX - 40) + 'px';
    stickBase.style.top  = (startY - 40) + 'px';

    stickNub.style.transform = 'translate(0,0)';
    self.joystick.x = 0;
    self.joystick.z = 0;
  }, { passive: false });

  stickZone.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var rect = stickZone.getBoundingClientRect();
    var cx = t.clientX - rect.left;
    var cy = t.clientY - rect.top;

    var dx = cx - startX;
    var dy = cy - startY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var maxDist = 50;

    if (dist > maxDist) {
      dx = dx / dist * maxDist;
      dy = dy / dist * maxDist;
      dist = maxDist;
    }

    stickNub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';

    self.joystick.x = dx / maxDist;
    /* Screen Y up (negative dy) = moving toward net = 3D -Z direction */
    self.joystick.z = dy / maxDist;
  }, { passive: false });

  stickZone.addEventListener('touchend', function (e) {
    e.preventDefault();
    stickBase.style.display = 'none';
    stickNub.style.transform = 'translate(0,0)';
    self.joystick.x = 0;
    self.joystick.z = 0;
  }, { passive: false });

  hitBtn.addEventListener('touchstart', function (e) {
    e.preventDefault();
    self._onHit();
  }, { passive: false });

  hitBtn.addEventListener('mousedown', function (e) {
    e.preventDefault();
    self._onHit();
  });
};

Game.prototype._onResize = function () {
  var w = window.innerWidth;
  var h = window.innerHeight;
  this.renderer.setSize(w, h);
  this.camera.aspect = w / h;
  this.camera.updateProjectionMatrix();
};

/* ============================================================
   SERVE
   ============================================================ */

Game.prototype._setupServe = function () {
  this.state            = 'SERVING';
  this.ball.inPlay      = false;
  this.ball.y           = BALL_R;
  this.ball.hitCooldown = 0;
  this.bounceState      = 'RECV';
  this.serveFirstBounce = true;

  var serverScore = this.scores[this.server];
  var rightSide   = (serverScore % 2 === 0);

  if (this.server === 0) {
    this.playerPos.x = rightSide ? 2.5 : -2.5;
    this.playerPos.z = 9;
    this.ball.x      = this.playerPos.x;
    this.ball.z      = this.playerPos.z;
  } else {
    this.aiPos.x = rightSide ? -2.5 : 2.5;
    this.aiPos.z = -9;
    this.ball.x  = this.aiPos.x;
    this.ball.z  = this.aiPos.z;
  }

  this._updateHUD();
  this._updateBounceHint();

  /* AI serves after delay */
  if (this.server === 1) {
    var self = this;
    this._aiServeTimer = setTimeout(function () {
      self._aiAutoServe();
    }, 1400);
  }
};

Game.prototype._launchServe = function (fromX, fromZ, towardPositiveZ) {
  var speed     = 9 + Math.random();
  var direction = towardPositiveZ ? 1 : -1;
  var dist      = Math.abs(fromZ);
  var arcFactor = dist / HALF_LEN;

  this.ball.x  = fromX;
  this.ball.z  = fromZ;
  this.ball.y  = BALL_R;
  this.ball.vz = direction * speed;
  this.ball.vy = 5 + arcFactor * 5;
  this.ball.vx = -fromX * 0.3 + (Math.random() - 0.5) * 0.5;
  this.ball.inPlay      = true;
  this.ball.hitCooldown = 0;

  this.lastHitter = this.server;
  this.state      = 'PLAYING';
};

Game.prototype._aiAutoServe = function () {
  if (this.state === 'SERVING' && this.server === 1) {
    this._launchServe(this.aiPos.x, this.aiPos.z, true);
  }
};

/* ============================================================
   HIT
   ============================================================ */

Game.prototype._onHit = function () {
  if (this.state === 'SERVING' && this.server === 0) {
    this._launchServe(this.playerPos.x, this.playerPos.z, false);
    return;
  }
  if (this.state === 'GAMEOVER') {
    return;
  }
  if (this.state !== 'PLAYING') return;
  this._tryPlayerHit();
};

Game.prototype._tryPlayerHit = function () {
  var dx        = this.ball.x - this.playerPos.x;
  var dz        = this.ball.z - this.playerPos.z;
  var horizDist = Math.sqrt(dx * dx + dz * dz);

  if (horizDist > HIT_RANGE_XZ || this.ball.y > HIT_RANGE_Y) return;
  if (this.ball.hitCooldown > 0) return;

  /* Two-bounce rule */
  var isVolley = this.ball.y > BALL_R + 0.15;
  if (isVolley) {
    if (this.bounceState === 'RECV' && this.server === 1) {
      /* player is receiver, must let it bounce first */
      this._showBounceHintFlash();
      this._fault(0, 'Must let it bounce!');
      return;
    }
    if (this.bounceState === 'SERV' && this.server === 0) {
      /* player is server, must let return bounce first */
      this._showBounceHintFlash();
      this._fault(0, 'Must let it bounce!');
      return;
    }
  }

  /* Kitchen volley fault */
  if (this.playerPos.z > 0 && this.playerPos.z < KIT_D && isVolley) {
    this._fault(0, 'Kitchen fault!');
    return;
  }

  this._doHit(this.playerPos.x, this.playerPos.z, false, false);
  this.lastHitter = 0;
};

Game.prototype._doHit = function (fromX, fromZ, towardPositiveZ, isAI) {
  var direction = towardPositiveZ ? 1 : -1;
  var dist      = Math.abs(fromZ);
  var speed     = isAI
    ? (7 + this.aiSettings.accuracy * Math.random())
    : (8 + Math.random() * 2);

  var arcFactor = Math.min(dist / HALF_LEN, 1);

  this.ball.vz = direction * speed;
  this.ball.vy = 4 + arcFactor * 6;
  this.ball.vx = -fromX * 0.4 + (Math.random() - 0.5) * (isAI ? this.aiSettings.accuracy : 1.2);
  this.ball.hitCooldown = 0.4;
};

/* ============================================================
   AI
   ============================================================ */

Game.prototype._updateAI = function (dt) {
  var ai       = this.aiSettings;
  var ball     = this.ball;
  var aiIsReceiver = (this.server === 0);

  /* Whether AI is forbidden from volleying (two-bounce) */
  var holdBack = (this.bounceState === 'RECV' && aiIsReceiver) ||
                 (this.bounceState === 'SERV' && !aiIsReceiver);

  var targetX, targetZ;

  if (!ball.inPlay) {
    targetX = 0;
    targetZ = -9;
  } else if (ball.vz > 0) {
    /* Ball moving toward player – AI retreats to default position */
    targetX = 0;
    targetZ = -9;
  } else {
    /* Ball moving toward AI (vz < 0) */
    this.aiReactionTimer -= dt;

    if (this.aiReactionTimer > 0) {
      targetX = this.aiPos.x;
      targetZ = -9;
    } else {
      /* Predict landing X */
      var travelTime = Math.abs(ball.z) / Math.abs(ball.vz || 0.01);
      var landX = ball.x + ball.vx * travelTime;
      landX = Math.max(-HALF_W, Math.min(HALF_W, landX));

      targetX = landX + (Math.random() - 0.5) * ai.accuracy * 2;
      targetZ = -7;

      /* Clamp */
      targetX = Math.max(-HALF_W + 0.3, Math.min(HALF_W - 0.3, targetX));
      targetZ = Math.max(-HALF_LEN + 0.5, Math.min(-0.2, targetZ));
    }
  }

  /* Move AI toward target */
  var step = ai.speed * dt;
  var adx = targetX - this.aiPos.x;
  var adz = targetZ - this.aiPos.z;
  var aDist = Math.sqrt(adx * adx + adz * adz);

  if (aDist > step) {
    this.aiPos.x += (adx / aDist) * step;
    this.aiPos.z += (adz / aDist) * step;
  } else {
    this.aiPos.x = targetX;
    this.aiPos.z = targetZ;
  }

  /* AI hit attempt */
  if (!holdBack && ball.inPlay) {
    var bdx       = ball.x - this.aiPos.x;
    var bdz       = ball.z - this.aiPos.z;
    var horizDist = Math.sqrt(bdx * bdx + bdz * bdz);

    if (horizDist < HIT_RANGE_XZ && ball.y < HIT_RANGE_Y &&
        ball.vz < 0 && ball.hitCooldown <= 0) {

      /* Kitchen volley fault for AI */
      if (this.aiPos.z < 0 && this.aiPos.z > -KIT_D && ball.y > BALL_R + 0.15) {
        this._fault(1, 'AI kitchen fault!');
        return;
      }

      /* Reset reaction timer for next shot */
      this.aiReactionTimer = ai.reactionDelay;
      this._doHit(this.aiPos.x, this.aiPos.z, true, true);
      this.lastHitter = 1;
    }
  }
};

/* ============================================================
   GROUND BOUNCE
   ============================================================ */

Game.prototype._onGroundBounce = function () {
  var ball       = this.ball;
  var bounceSide = (ball.z < 0) ? 1 : 0; /* 1 = AI side, 0 = player side */

  if (this.serveFirstBounce) {
    this.serveFirstBounce = false;
    var valid = false;

    if (this.server === 0) {
      /* Player serves – must land on AI side beyond kitchen */
      valid = (bounceSide === 1 &&
               ball.z < -KIT_D &&
               ball.z > -HALF_LEN &&
               Math.abs(ball.x) < HALF_W);
    } else {
      /* AI serves – must land on player side beyond kitchen */
      valid = (bounceSide === 0 &&
               ball.z > KIT_D &&
               ball.z < HALF_LEN &&
               Math.abs(ball.x) < HALF_W);
    }

    if (!valid) {
      this._fault(this.server, 'Serve fault!');
      return;
    }
    this.bounceState = 'SERV';
  } else {
    if (this.bounceState === 'RECV') {
      this.bounceState = 'SERV';
    } else if (this.bounceState === 'SERV') {
      this.bounceState = 'FREE';
    }
  }

  this._updateBounceHint();
};

/* ============================================================
   FAULT / SCORING
   ============================================================ */

Game.prototype._fault = function (faulter, reason) {
  this.ball.inPlay = false;
  var winner = 1 - faulter;
  var msg;

  if (this.server === winner) {
    this.scores[winner]++;
    msg = (winner === 0 ? 'YOU' : 'AI') + ' score! ' + reason;
  } else {
    this.server = winner;
    msg = (winner === 0 ? 'YOU' : 'AI') + ' win rally! ' + reason;
  }

  this._updateHUD();
  this._showFloatMsg(msg);

  var self = this;
  setTimeout(function () {
    self._checkGameOver();
  }, 2000);
};

Game.prototype._checkGameOver = function () {
  var s0 = this.scores[0];
  var s1 = this.scores[1];

  if ((s0 >= WIN_SCORE || s1 >= WIN_SCORE) && Math.abs(s0 - s1) >= WIN_BY) {
    this.state = 'GAMEOVER';
    var playerWon = s0 > s1;

    document.getElementById('over-result').textContent = playerWon ? 'YOU WIN!' : 'AI WINS';
    document.getElementById('over-result').style.color  = playerWon ? '#f1c40f' : '#e74c3c';
    document.getElementById('over-score').textContent   = s0 + ' – ' + s1;

    document.getElementById('hud').style.display         = 'none';
    document.getElementById('touch-ctrl').style.display  = 'none';

    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('over-screen').style.display = 'block';
    document.getElementById('overlay').style.display     = 'flex';
    return;
  }
  this._setupServe();
};

/* ============================================================
   HUD
   ============================================================ */

Game.prototype._updateHUD = function () {
  document.getElementById('hud-p-score').textContent = this.scores[0];
  document.getElementById('hud-a-score').textContent = this.scores[1];

  var charName = CHARACTERS[this.charIdx].name.toUpperCase();
  document.getElementById('hud-p-name').textContent  = charName;

  var serveTxt = (this.server === 0) ? charName + ' SERVE' : 'AI SERVE';
  document.getElementById('hud-serve-txt').textContent = serveTxt;
};

Game.prototype._updateBounceHint = function () {
  var hint = document.getElementById('bounce-hint');
  if (this.state === 'PLAYING' && this.bounceState !== 'FREE') {
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
};

Game.prototype._showBounceHintFlash = function () {
  var hint = document.getElementById('bounce-hint');
  hint.style.display = 'block';
  var self = this;
  setTimeout(function () {
    self._updateBounceHint();
  }, 1500);
};

Game.prototype._showFloatMsg = function (msg) {
  var el = document.getElementById('float-msg');
  el.textContent   = msg;
  el.style.display = 'block';
  setTimeout(function () {
    el.style.display = 'none';
  }, 2000);
};

/* ============================================================
   UPDATE
   ============================================================ */

Game.prototype._update = function (dt) {
  var ball  = this.ball;
  var speed = 6;

  if (this.state === 'SERVING') {
    /* Player can reposition on their side while waiting to serve */
    if (this.server === 0) {
      var mvx = 0, mvz = 0;
      if (this.keys.left)  mvx -= 1;
      if (this.keys.right) mvx += 1;
      if (this.keys.up)    mvz -= 1;
      if (this.keys.down)  mvz += 1;
      mvx += this.joystick.x;
      mvz += this.joystick.z;

      var len = Math.sqrt(mvx * mvx + mvz * mvz);
      if (len > 1) { mvx /= len; mvz /= len; }

      this.playerPos.x = Math.max(-HALF_W + 0.3, Math.min(HALF_W - 0.3,
        this.playerPos.x + mvx * speed * dt));
      this.playerPos.z = Math.max(0.2, Math.min(HALF_LEN - 0.3,
        this.playerPos.z + mvz * speed * dt));
    }

    /* Ball tracks server */
    if (this.server === 0) {
      ball.x = this.playerPos.x;
      ball.z = this.playerPos.z;
    } else {
      ball.x = this.aiPos.x;
      ball.z = this.aiPos.z;
    }
    return;
  }

  if (this.state !== 'PLAYING') return;

  /* ---- Player movement ---- */
  var pmx = 0, pmz = 0;
  if (this.keys.left)  pmx -= 1;
  if (this.keys.right) pmx += 1;
  if (this.keys.up)    pmz -= 1;
  if (this.keys.down)  pmz += 1;

  pmx += this.joystick.x;
  pmz += this.joystick.z;

  var plen = Math.sqrt(pmx * pmx + pmz * pmz);
  if (plen > 1) { pmx /= plen; pmz /= plen; }

  this.playerPos.x = Math.max(-HALF_W + 0.3, Math.min(HALF_W - 0.3,
    this.playerPos.x + pmx * speed * dt));
  this.playerPos.z = Math.max(0.2, Math.min(HALF_LEN - 0.3,
    this.playerPos.z + pmz * speed * dt));

  /* ---- AI movement ---- */
  this._updateAI(dt);

  /* ---- Ball physics ---- */
  if (!ball.inPlay) return;

  ball.hitCooldown = Math.max(0, ball.hitCooldown - dt);

  var prevY = ball.y;
  var prevZ = ball.z;

  ball.vy -= GRAVITY * dt;
  ball.x  += ball.vx * dt;
  ball.y  += ball.vy * dt;
  ball.z  += ball.vz * dt;

  /* ---- Ground bounce ---- */
  if (ball.y <= BALL_R) {
    ball.y  = BALL_R;
    ball.vy = Math.abs(ball.vy) * BOUNCE_REST;
    ball.vx *= 0.92;
    ball.vz *= 0.92;
    if (Math.abs(ball.vy) < 0.8) ball.vy = 0;
    this._onGroundBounce();
    if (!ball.inPlay) return; /* fault was triggered */
  }

  /* ---- Net collision ---- */
  if ((prevZ > 0 && ball.z <= 0) || (prevZ < 0 && ball.z >= 0)) {
    var t      = (0 - prevZ) / ((ball.z - prevZ) || 0.0001);
    var yAtNet = prevY + (ball.y - prevY) * t;
    if (yAtNet < NET_H) {
      this._fault(this.lastHitter, 'Net!');
      return;
    }
  }

  /* ---- Out of bounds ---- */
  if (ball.z > HALF_LEN + 0.5) {
    this._fault(0, 'Out!');
    return;
  }
  if (ball.z < -HALF_LEN - 0.5) {
    this._fault(1, 'Out!');
    return;
  }
  if (Math.abs(ball.x) > HALF_W + 0.5) {
    this._fault(this.lastHitter, 'Out!');
    return;
  }

  /* ---- Dead ball (settled on court) ---- */
  if (ball.vy === 0 && Math.abs(ball.vz) < 0.3 && Math.abs(ball.vx) < 0.3) {
    if (ball.z < 0) {
      this._fault(1, 'Missed!');
    } else {
      this._fault(0, 'Missed!');
    }
    return;
  }

  /* Update bounce hint while playing */
  this._updateBounceHint();
};

/* ============================================================
   RENDER
   ============================================================ */

Game.prototype._render = function () {
  var ball = this.ball;

  /* Characters */
  this.playerMesh.position.set(this.playerPos.x, 0, this.playerPos.z);
  this.aiMesh.position.set(this.aiPos.x, 0, this.aiPos.z);

  /* Ball */
  if (!ball.inPlay && this.state === 'SERVING') {
    if (this.server === 0) {
      this.ballMesh.position.set(this.playerPos.x, 1.4, this.playerPos.z - 0.3);
    } else {
      this.ballMesh.position.set(this.aiPos.x, 1.4, this.aiPos.z + 0.3);
    }
  } else {
    this.ballMesh.position.set(ball.x, ball.y, ball.z);
  }

  /* Ball shadow – always on ground */
  this.ballShadow.position.x = this.ballMesh.position.x;
  this.ballShadow.position.z = this.ballMesh.position.z;

  var scale = Math.max(0.1, 1 - this.ballMesh.position.y * 0.2);
  this.ballShadow.scale.set(scale, scale, scale);

  this.renderer.render(this.scene, this.camera);
};

/* ============================================================
   LOOP
   ============================================================ */

Game.prototype._loop = function (ts) {
  if (this._destroyed) return;

  if (this._lastTime === null) this._lastTime = ts;
  var dt = Math.min((ts - this._lastTime) / 1000, 0.05);
  this._lastTime = ts;

  this._update(dt);
  this._render();

  requestAnimationFrame(this._boundLoop);
};

/* ============================================================
   DESTROY  (cleanup before creating new game)
   ============================================================ */

Game.prototype.destroy = function () {
  this._destroyed = true;

  if (this._aiServeTimer) clearTimeout(this._aiServeTimer);

  window.removeEventListener('keydown', this._onKeyDown);
  window.removeEventListener('keyup',   this._onKeyUp);
  window.removeEventListener('resize',  this._onResizeBound);

  /* Dispose Three.js objects */
  this.scene.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(function (m) { m.dispose(); });
      } else {
        obj.material.dispose();
      }
    }
  });
  this.renderer.dispose();
};

/* ============================================================
   MODULE-LEVEL: startGame / UI wiring
   ============================================================ */

var _currentGame  = null;
var _selectedChar = 0;
var _selectedDiff = 'medium';

function startGame(charIdx, diff) {
  /* Tear down previous game */
  if (_currentGame) {
    _currentGame.destroy();
    _currentGame = null;
  }

  _selectedChar = (charIdx !== undefined) ? charIdx : _selectedChar;
  _selectedDiff = (diff    !== undefined) ? diff    : _selectedDiff;

  /* Hide overlay */
  document.getElementById('overlay').style.display = 'none';

  /* Show HUD */
  document.getElementById('hud').style.display = 'flex';

  /* Touch controls – let CSS media query handle visibility */
  var touchCtrl = document.getElementById('touch-ctrl');
  touchCtrl.style.removeProperty('display');

  /* Reset transient UI */
  document.getElementById('float-msg').style.display   = 'none';
  document.getElementById('bounce-hint').style.display = 'none';

  _currentGame = new Game(_selectedChar, _selectedDiff);
}

/* ---- Menu wiring (runs once DOM is ready) ---- */
document.addEventListener('DOMContentLoaded', function () {

  /* Character cards */
  var cards = document.querySelectorAll('.char-card');
  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      cards.forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      _selectedChar = parseInt(card.dataset.idx, 10);
    });
  });

  /* Difficulty buttons */
  var diffBtns = document.querySelectorAll('.diff-btn');
  diffBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      diffBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _selectedDiff = btn.dataset.diff;
    });
  });

  /* Play button */
  document.getElementById('play-btn').addEventListener('click', function () {
    startGame(_selectedChar, _selectedDiff);
  });

  /* Replay button */
  document.getElementById('replay-btn').addEventListener('click', function () {
    document.getElementById('over-screen').style.display = 'none';
    startGame(_selectedChar, _selectedDiff);
  });

  /* Menu button (from game-over screen) */
  document.getElementById('menu-btn').addEventListener('click', function () {
    if (_currentGame) {
      _currentGame.destroy();
      _currentGame = null;
    }
    document.getElementById('hud').style.display         = 'none';
    document.getElementById('touch-ctrl').style.display  = 'none';
    document.getElementById('float-msg').style.display   = 'none';
    document.getElementById('bounce-hint').style.display = 'none';
    document.getElementById('over-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'block';
    document.getElementById('overlay').style.display     = 'flex';
  });
});
