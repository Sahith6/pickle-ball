var CHARACTERS = [
  { name:'Alex',   skinColor:0xD4956A, jerseyColor:0x2980B9, shortsColor:0x1A5276, hairColor:0x2C1810, paddleColor:0xE74C3C },
  { name:'Jordan', skinColor:0xF0C080, jerseyColor:0xE67E22, shortsColor:0x784212, hairColor:0xD4AC0D, paddleColor:0x27AE60 },
  { name:'River',  skinColor:0xFAD7A0, jerseyColor:0x27AE60, shortsColor:0x1E8449, hairColor:0xC0392B, paddleColor:0x8E44AD },
  { name:'Taylor', skinColor:0x8D6E63, jerseyColor:0x8E44AD, shortsColor:0x4A235A, hairColor:0x1C1C1C, paddleColor:0xF39C12 }
];

function createCharacter(cfg, facingPositiveZ) {
  // facingPositiveZ = true means character faces toward positive Z (AI faces player)
  var g = new THREE.Group();
  function mat(c){ return new THREE.MeshPhongMaterial({color:c}); }

  // Legs
  var legG = new THREE.BoxGeometry(0.22,0.7,0.22);
  var lL = new THREE.Mesh(legG, mat(cfg.shortsColor)); lL.position.set(-0.15,0.35,0); g.add(lL);
  var rL = new THREE.Mesh(legG, mat(cfg.shortsColor)); rL.position.set( 0.15,0.35,0); g.add(rL);

  // Torso
  var torsoG = new THREE.BoxGeometry(0.55,0.65,0.28);
  var torso = new THREE.Mesh(torsoG, mat(cfg.jerseyColor)); torso.position.set(0,1.08,0); g.add(torso);

  // Head
  var headG = new THREE.SphereGeometry(0.27,8,6);
  var head = new THREE.Mesh(headG, mat(cfg.skinColor)); head.position.set(0,1.65,0); g.add(head);

  // Hair cap
  var hairG = new THREE.SphereGeometry(0.285,8,4,0,Math.PI*2,0,Math.PI*0.55);
  var hair = new THREE.Mesh(hairG, mat(cfg.hairColor)); hair.position.set(0,1.65,0); g.add(hair);

  // Arms
  var armG = new THREE.BoxGeometry(0.18,0.58,0.18);
  var lA = new THREE.Mesh(armG, mat(cfg.jerseyColor)); lA.position.set(-0.37,1.05,0); g.add(lA);
  var rA = new THREE.Mesh(armG, mat(cfg.jerseyColor)); rA.rotation.z=-0.4; rA.position.set(0.42,1.1,0.1); g.add(rA);

  // Paddle handle
  var pHG = new THREE.BoxGeometry(0.06,0.28,0.06);
  var pH = new THREE.Mesh(pHG, mat(0x8B4513)); pH.position.set(0.64,0.9,0.22); g.add(pH);

  // Paddle face
  var pFG = new THREE.BoxGeometry(0.38,0.04,0.44);
  var pF = new THREE.Mesh(pFG, mat(cfg.paddleColor)); pF.position.set(0.64,1.13,0.22); g.add(pF);

  if (facingPositiveZ) g.rotation.y = Math.PI;

  g.traverse(function(c){ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } });
  return g;
}
