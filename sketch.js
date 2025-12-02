console.log('sketch.js chargé');

// === Variables globales Pong ===
let x, y;          // position balle
let dx, dy;        // vitesse balle
let d;             // diamètre balle
let coul;          // couleur balle

let z;             // raquette joueur (gauche)
let longueur;      // hauteur raquette
let iaZ;           // raquette IA (droite)

let scoreJoueur = 0;
let scoreIa = 0;

let gameOver = false;
let couleurSwitch = false;
let hasWon = false;   

// === WebSocket + Nunchuk ===
let socket;
let joyY = 128;      
let joyYFiltre = 128; 
let zButton = false;
let cButton = false;
let lastZ = null;
let lastC = null;

function setup() {
  console.log('setup() lancé');
  createCanvas(1000, 800);
  frameRate(60);
  initGame();

  // WebSocket sur le même host:port que serveur.js
  socket = new WebSocket('ws://' + window.location.host);
  console.log('Connexion WS : ws://' + window.location.host);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    joyY = data.joyY;
    zButton = data.zPressed;
    cButton = data.cPressed;

    if (gameOver) {
      if (lastZ !== null && data.zPressed !== lastZ) {
        restartGame();
      } else if (lastC !== null && data.cPressed !== lastC) {
        restartGame();
      }
    }

    lastZ = data.zPressed;
    lastC = data.cPressed;
  };

  socket.onerror = (err) => {
    console.error('WebSocket erreur :', err);
  };

  socket.onclose = () => {
    console.log('WebSocket fermé');
  };
}

function initGame() {
  x = width / 2;
  y = height / 2;

  dx = 5;
  dy = 4;
  d = 30;

  z = 400;
  iaZ = 400;
  longueur = 150;

  coul = color(255, 50, 50);
  gameOver = false;
  hasWon = false;

  joyYFiltre = joyY;
}

function draw() {
  background(10, 20, 40);

  dessinerTerrain();
  dessinerRaquetteJoueur();
  dessinerRaquetteIA();
  dessinerBalle();
  dessinerScore();

  if (gameOver) {
    dessinerGameOverOverlay();
    return;
  }

  bougerBalle();
  bougerRaquetteJoueur();
  bougerRaquetteIA();
  rebondir();
}

// === Terrain simple ===
function dessinerTerrain() {
  stroke(255);
  strokeWeight(10);
  noFill();
  rect(100, 150, 800, 600);

  // Ligne centrale pointillée
  stroke(255, 255, 255, 120);
  strokeWeight(4);
  for (let i = 150; i < 750; i += 40) {
    line(width / 2, i, width / 2, i + 20);
  }
}

function dessinerRaquetteJoueur() {
  noStroke();
  fill(255);
  rect(150, z, 25, longueur, 8);
}

function dessinerRaquetteIA() {
  noStroke();
  fill(0, 255, 180);
  rect(825, iaZ, 25, longueur, 8);
}

function dessinerBalle() {
  noStroke();
  fill(coul);
  ellipse(x, y, d, d);
}

function dessinerScore() {
  fill(0, 180);
  noStroke();
  rect(0, 0, width, 100);

  textAlign(CENTER);
  textSize(40);
  fill(0, 255, 0);
  text("PONG NUNCHUK", width / 2, 65);

  textSize(60);
  fill(255);
  text(scoreJoueur, width / 2 - 100, 200);
  text(scoreIa,     width / 2 + 100, 200);
}

function dessinerGameOverOverlay() {
  fill(0, 180);
  noStroke();
  rect(0, height / 2 - 100, width, 200);
  textAlign(CENTER);
  textSize(80);
  if (hasWon) {
    fill(0, 255, 0);
    text("VOUS AVEZ GAGNÉ", width / 2, height / 2);
  } else {
    fill(255, 0, 0);
    text("VOUS AVEZ PERDU", width / 2, height / 2);
  }
  textSize(30);
  fill(255);
  text("Appuie sur Z ou C du Nunchuk pour rejouer", width / 2, height / 2 + 50);
}

function bougerBalle() {
  x += dx;
  y += dy;
}

// === Joystick Nunchuk -> raquette joueur (stable + axe Y inversé) ===
function bougerRaquetteJoueur() {
  // Filtre pour lisser (0.1 = très stable, 0.3 = plus réactif)
  joyYFiltre = lerp(joyYFiltre, joyY, 0.12);

  // Plage utile pour virer les extrêmes
  let joyYLimite = constrain(joyYFiltre, 75, 180);


  z = map(joyYLimite, 75, 180, 750 - longueur, 150);

 
  const centre = 128;
  const deadZone = 8;
  if (abs(joyYFiltre - centre) < deadZone) {
    z = lerp(z, (150 + (750 - longueur)) / 2, 0.02);
  }

  z = constrain(z, 150, 750 - longueur);
}

function bougerRaquetteIA() {

  let cible = y - longueur / 2;
  let diff = cible - iaZ;

  let maxVitesseIA = 4.5;
  diff = constrain(diff, -maxVitesseIA, maxVitesseIA);

  iaZ += diff;
  iaZ = constrain(iaZ, 150, 750 - longueur);
}

function rebondir() {
 
  if (y + d / 2 > 750 && dy > 0) dy = -dy;
  if (y - d / 2 < 150 && dy < 0) dy = -dy;


  if (
    dx < 0 &&                          
    x - d / 2 <= 175 &&            
    x + d / 2 >= 150 &&                 
    y > z && y < z + longueur           
  ) {
    dx = -dx * 1.05;
    dy *= 1.05;
    limiterVitesseBalle();
    scoreJoueur++;
    changerCouleurBalle();
  }

  // --- Collision raquette IA (droite) ---
  if (
    dx > 0 &&                            // balle va vers la droite
    x + d / 2 >= 825 &&                  // bord droit proche raquette
    x - d / 2 <= 850 &&                  
    y > iaZ && y < iaZ + longueur        
  ) {
    dx = -dx * 1.05;
    dy *= 1.05;
    limiterVitesseBalle();
    scoreIa++;
    changerCouleurBalle();
  }

  // --- Mur gauche (ton mur) -> tu perds ---
  if (x - d / 2 < 100) {
    scoreIa++;
    gameOverScreen(false);
    return;
  }

  // --- Mur droit (mur de l'adversaire) -> tu gagnes ---
  if (x + d / 2 > 900) {
    scoreJoueur++;
    gameOverScreen(true);
    return;
  }
}

function limiterVitesseBalle() {
  const maxV = 12;
  dx = constrain(dx, -maxV, maxV);
  dy = constrain(dy, -maxV, maxV);
}

function changerCouleurBalle() {
  if (couleurSwitch) {
    coul = color(255, 50, 50);
  } else {
    coul = color(50, 255, 150);
  }
  couleurSwitch = !couleurSwitch;
}

function gameOverScreen(win) {
  hasWon = win;
  gameOver = true;
}

function restartGame() {
  scoreJoueur = 0;
  scoreIa = 0;
  initGame();
  loop();   // on s’assure que draw() tourne bien
}

// Sécurité : relance clavier
function keyPressed() {
  if ((key === 'r' || key === 'R') && gameOver) {
    restartGame();
  }
}
