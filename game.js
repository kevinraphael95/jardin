const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, tool = 'plant', time = 0, wind = 0;
const keys = {};
const isMobile = () => window.innerWidth <= 600 || window.matchMedia('(pointer:coarse)').matches;

const dpMap = { 'dp-up':'KeyW','dp-down':'KeyS','dp-left':'KeyA','dp-right':'KeyD' };
Object.entries(dpMap).forEach(([id,code]) => {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); keys[code]=true; });
  el.addEventListener('pointerup',   e=>{ e.preventDefault(); keys[code]=false; });
  el.addEventListener('pointerout',  ()=>{ keys[code]=false; });
});
window.addEventListener('keydown', e=>keys[e.code]=true);
window.addEventListener('keyup',   e=>keys[e.code]=false);

function setTool(t) {
  tool = t;
  document.getElementById('b-plant').classList.toggle('active', t==='plant');
  document.getElementById('b-cut').classList.toggle('active', t==='cut');
}

const player = { x:0, y:0, vx:0, vy:0, dir:1, moving:false };

const ROWS = 24;
const HR   = 0.38;
const horizon = () => H * HR;
const rowY    = r => horizon() + (r/ROWS)*(H-horizon());
const scaleAt = y => 0.12 + 0.88*((y-horizon())/(H-horizon()));
const rowOf   = y => Math.max(0,Math.min(ROWS-1,Math.floor(((y-horizon())/(H-horizon()))*ROWS)));

/* ease functions */
const easeOutQuart = t => 1-(1-t)**4;
const easeInOutCubic = t => t<0.5 ? 4*t*t*t : 1-(-2*t+2)**3/2;
const lerp = (a,b,t) => a+(b-a)*t;

let blades=[], flowers=[], petals=[], clouds=[], birds=[];

function initScene() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  player.x = W/2;
  player.y = H*0.72;

  blades = [];
  const totalBlades = Math.floor(W * 1.8);
  for (let i=0; i<totalBlades; i++) {
    const y = horizon() + Math.random()*(H-horizon());
    const sc = scaleAt(y);
    blades.push({
      x: Math.random()*W,
      y, row: rowOf(y), sc,
      h: (10+Math.random()*30)*sc,
      w: (0.7+Math.random()*2.0)*sc,
      offset: Math.random()*Math.PI*2,
      hue: 85+Math.random()*42,
      sat: 25+Math.random()*20,
      lit: 14+Math.random()*18
    });
  }
  blades.sort((a,b)=>a.y-b.y);

  clouds = [];
  for (let i=0;i<7;i++) {
    clouds.push({
      x: Math.random()*W,
      y: 15+Math.random()*H*0.17,
      speed: 0.05+Math.random()*0.1,
      alpha: 0.5+Math.random()*0.35,
      puffs: Array.from({length:3+Math.floor(Math.random()*3)},()=>({
        dx:(Math.random()-0.5)*90, dy:(Math.random()-0.3)*22, r:14+Math.random()*30
      }))
    });
  }

  birds = [];
  for (let i=0;i<7;i++) birds.push({
    x:Math.random()*W, y:25+Math.random()*H*0.15,
    speed:0.3+Math.random()*0.5, phase:Math.random()*Math.PI*2, size:3+Math.random()*4
  });
}

/* ══════════════════════════════════════════
   TYPES DE FLEURS
   0 = rose / coquelicot (pétales arrondis)
   1 = marguerite / tournesol (pétales fins rayonnants)
   2 = tulipe
   3 = lavande / grappe
   4 = clochette / digitale
   ══════════════════════════════════════════ */
const FLOWER_TYPES = [
  { name:'rose',     petalMin:5, petalMax:8 },
  { name:'marguerite', petalMin:10, petalMax:16 },
  { name:'tulipe',   petalMin:3, petalMax:3 },
  { name:'lavande',  petalMin:0, petalMax:0 },
  { name:'clochette',petalMin:0, petalMax:0 },
];

const PALETTES = [
  { p:'#e8445a', p2:'#ff8fa3', c:'#ffe066', s:'#3a8c3f', s2:'#2d6b32' },
  { p:'#f7c948', p2:'#fff176', c:'#7a4000', s:'#4a9640', s2:'#336629' },
  { p:'#ff9ecd', p2:'#ffd6ea', c:'#ffe066', s:'#4aaa46', s2:'#357a32' },
  { p:'#a78bfa', p2:'#d8b4fe', c:'#ffe066', s:'#3e8c3a', s2:'#2c6428' },
  { p:'#fff',    p2:'#e8f5e9', c:'#ffe066', s:'#45a040', s2:'#2d7a29' },
  { p:'#ff7043', p2:'#ffab91', c:'#222',    s:'#43a047', s2:'#2e7031' },
  { p:'#b39ddb', p2:'#7e57c2', c:'#fff9c4', s:'#558b2f', s2:'#33691e' },
  { p:'#80deea', p2:'#26c6da', c:'#fff',    s:'#43a047', s2:'#1b5e20' },
];

function createFlower(x, y) {
  const r = rowOf(y);
  if (r<0||r>=ROWS) return;
  const sc = scaleAt(y);
  const type = Math.floor(Math.random()*FLOWER_TYPES.length);
  const ft = FLOWER_TYPES[type];
  const pal = PALETTES[Math.floor(Math.random()*PALETTES.length)];
  const nPetals = ft.petalMin + Math.floor(Math.random()*(ft.petalMax-ft.petalMin+1));
  flowers.push({
    x, y, row:r, sc, type,
    palette: pal,
    nPetals,
    maxH: (50+Math.random()*55)*sc,
    size: (6+Math.random()*9)*sc,
    h: 0, progress: 0,
    growSpeed: 0.004+Math.random()*0.003,
    seed: Math.random()*100,
    sway: Math.random()*Math.PI*2,
    swayAmp: 0.6+Math.random()*0.9,
    // tige : 1-3 feuilles à des hauteurs variées
    leaves: Array.from({length:1+Math.floor(Math.random()*2)},()=>({
      side: Math.random()<0.5?1:-1,
      t: 0.3+Math.random()*0.35,   // position sur la tige (0-1)
      angle: 0.3+Math.random()*0.5,
      size: 0.7+Math.random()*0.6
    })),
    born: time
  });
  flowers.sort((a,b)=>a.y-b.y);
}

function spawnPetal(f) {
  for (let i=0;i<3;i++) petals.push({
    x:f.x, y:f.y-f.h,
    vx:(Math.random()-0.5)*2,
    vy:-Math.random()*2-0.3,
    rot:Math.random()*Math.PI*2,
    rotSpeed:(Math.random()-0.5)*0.12,
    alpha:0.95, color:f.palette.p,
    size:f.size*(0.35+Math.random()*0.3), life:1
  });
}

/* ══ DESSIN TIGE ══ */
function drawStem(f, tx, ty, progress) {
  const stemProgress = easeOutQuart(Math.min(progress*1.6,1));
  const currentH = f.h * stemProgress;
  const pal = f.palette;

  // tige principale avec dégradé de couleur (base plus sombre)
  const steps = 12;
  for (let i=0;i<steps;i++) {
    const t0 = i/steps, t1 = (i+1)/steps;
    const sw0 = Math.sin(time*1.3+f.sway)*f.swayAmp*f.sc*t0 + wind*18*f.sc*t0;
    const sw1 = Math.sin(time*1.3+f.sway)*f.swayAmp*f.sc*t1 + wind*18*f.sc*t1;
    const x0 = f.x + sw0, y0 = f.y - currentH*t0;
    const x1 = f.x + sw1, y1 = f.y - currentH*t1;
    const lit = Math.round(lerp(18,34,t0));
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
    ctx.strokeStyle = `hsl(125,50%,${lit}%)`;
    ctx.lineWidth = Math.max(0.8,(3.5-t0*2.2)*f.sc);
    ctx.lineCap = 'round'; ctx.stroke();
  }

  // feuilles — apparaissent progressivement
  f.leaves.forEach(leaf => {
    const leafAppear = easeOutQuart(Math.max(0,Math.min((progress-0.2)/0.45,1)));
    if (leafAppear < 0.01) return;
    const lp = leaf.t;
    const sw = Math.sin(time*1.3+f.sway)*f.swayAmp*f.sc*lp + wind*18*f.sc*lp;
    const lx = f.x + sw;
    const ly = f.y - currentH*lp;
    const ls = f.sc * 14 * leaf.size * leafAppear;

    ctx.save();
    ctx.translate(lx, ly);
    const windAngle = wind*0.3*lp;
    ctx.rotate(leaf.side*(leaf.angle+windAngle));

    // forme feuille réaliste : ellipse pointue
    ctx.beginPath();
    ctx.save();
    ctx.scale(1, 0.38);
    ctx.arc(ls*0.5, 0, ls*0.5, 0, Math.PI*2);
    ctx.restore();

    const lg = ctx.createLinearGradient(0,0,ls,0);
    lg.addColorStop(0, pal.s2);
    lg.addColorStop(0.5, pal.s);
    lg.addColorStop(1, pal.s2);
    ctx.fillStyle = lg;
    ctx.globalAlpha = 0.88*leafAppear;
    ctx.fill();

    // nervure centrale
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(ls,0);
    ctx.strokeStyle = pal.s2;
    ctx.lineWidth = 0.7*f.sc;
    ctx.globalAlpha = 0.5*leafAppear;
    ctx.stroke();

    ctx.restore();
  });
}

/* ══ FLEURS PAR TYPE ══ */

function drawRose(f, cx, cy, progress, size) {
  const pal = f.palette;
  const open = easeInOutCubic(Math.min(progress*1.4,1));

  // pétales extérieurs
  for (let layer=0;layer<2;layer++) {
    const n = f.nPetals + layer*2;
    const r = size*(0.5+layer*0.4+open*0.3);
    const pSize = size*(0.55+open*0.2-layer*0.08);
    ctx.save(); ctx.translate(cx,cy);
    ctx.rotate(f.seed+time*0.12+layer*0.3);
    for (let i=0;i<n;i++) {
      ctx.save();
      ctx.rotate((Math.PI*2/n)*i);
      const pg = ctx.createRadialGradient(r,0,0,r,0,pSize*1.2);
      pg.addColorStop(0, layer===0?pal.p:pal.p2);
      pg.addColorStop(1, layer===0?pal.p2+'cc':pal.p+'88');
      ctx.beginPath();
      ctx.ellipse(r, 0, pSize*(0.55+open*0.2), pSize*(0.32+open*0.1), 0, 0, Math.PI*2);
      ctx.fillStyle = pg;
      ctx.globalAlpha = 0.82+layer*0.08;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  // coeur
  ctx.save(); ctx.translate(cx,cy);
  const cg = ctx.createRadialGradient(0,0,0,0,0,size*0.28);
  cg.addColorStop(0, pal.c);
  cg.addColorStop(1, pal.p);
  ctx.beginPath(); ctx.arc(0,0,size*0.28,0,Math.PI*2);
  ctx.fillStyle = cg; ctx.globalAlpha=1; ctx.fill();
  ctx.restore();
}

function drawMarguerite(f, cx, cy, progress, size) {
  const pal = f.palette;
  const open = easeInOutCubic(Math.min(progress*1.3,1));
  const n = f.nPetals;
  const petalL = size*(0.9+open*0.3);
  const petalW = size*(0.18+open*0.06);

  ctx.save(); ctx.translate(cx,cy);
  ctx.rotate(f.seed+time*0.08);
  for (let i=0;i<n;i++) {
    ctx.save(); ctx.rotate((Math.PI*2/n)*i);
    const pg = ctx.createLinearGradient(0,0,petalL,0);
    pg.addColorStop(0, pal.p2);
    pg.addColorStop(0.6, pal.p);
    pg.addColorStop(1, pal.p+'aa');
    ctx.beginPath();
    ctx.ellipse(petalL*0.5, 0, petalL*0.5, petalW, 0, 0, Math.PI*2);
    ctx.fillStyle = pg;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.restore();
  }
  // centre disque
  const dg = ctx.createRadialGradient(-size*0.06,-size*0.06,0,0,0,size*0.32);
  dg.addColorStop(0, pal.c+'ff');
  dg.addColorStop(0.6, pal.c);
  dg.addColorStop(1, '#6d3a00');
  ctx.beginPath(); ctx.arc(0,0,size*0.32,0,Math.PI*2);
  ctx.fillStyle=dg; ctx.globalAlpha=1; ctx.fill();
  // grains sur le disque
  ctx.fillStyle='rgba(0,0,0,0.2)';
  for (let i=0;i<8;i++) {
    const a=(Math.PI*2/8)*i, rr=size*0.18;
    ctx.beginPath(); ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr,size*0.04,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawTulipe(f, cx, cy, progress, size) {
  const pal = f.palette;
  const open = easeInOutCubic(Math.min(progress*1.2,1));

  ctx.save(); ctx.translate(cx,cy);
  ctx.rotate(f.seed);

  // 3 pétales extérieurs
  for (let i=0;i<3;i++) {
    ctx.save(); ctx.rotate((Math.PI*2/3)*i);
    const spreadAngle = open*0.55;
    ctx.rotate(-spreadAngle);
    const ph = size*(1.1+open*0.2);
    const pw = size*(0.5+open*0.1);
    const pg = ctx.createLinearGradient(0,0,0,-ph);
    pg.addColorStop(0, pal.p);
    pg.addColorStop(0.5, pal.p2);
    pg.addColorStop(1, pal.p+'cc');
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(-pw*0.7,-ph*0.3,-pw*0.9,-ph*0.7,0,-ph);
    ctx.bezierCurveTo(pw*0.9,-ph*0.7,pw*0.7,-ph*0.3,0,0);
    ctx.fillStyle=pg; ctx.globalAlpha=0.88; ctx.fill();
    ctx.restore();
  }
  // étamines
  if (open>0.6) {
    const ao = (open-0.6)/0.4;
    ctx.globalAlpha=ao;
    for (let i=0;i<5;i++) {
      const a=(Math.PI*2/5)*i;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*size*0.3,Math.sin(a)*size*0.3-size*0.1);
      ctx.strokeStyle='#ffe066'; ctx.lineWidth=size*0.06*f.sc; ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(a)*size*0.32,Math.sin(a)*size*0.32-size*0.1,size*0.06,0,Math.PI*2);
      ctx.fillStyle='#ffe066'; ctx.fill();
    }
  }
  ctx.restore();
}

function drawLavande(f, cx, cy, progress, size) {
  const pal = f.palette;
  const open = easeOutQuart(Math.min(progress*1.1,1));
  const nFleurs = Math.floor(8+open*10);

  ctx.save(); ctx.translate(cx,cy);
  // grappe allongée
  for (let i=0;i<nFleurs;i++) {
    const t = i/nFleurs;
    const appear = easeOutQuart(Math.max(0,Math.min((open-t*0.4)/0.6,1)));
    if (appear<0.01) continue;
    const gy = -size*0.4 - t*size*1.4;
    const gx = Math.sin(t*Math.PI*2.5+f.seed)*size*0.22;
    const gs = size*(0.18+Math.random()*0.05)*appear;
    // petite fleur en cloche
    ctx.save(); ctx.translate(gx,gy);
    ctx.beginPath();
    ctx.ellipse(0,0,gs*0.7,gs,0,0,Math.PI*2);
    ctx.fillStyle = t>0.5?pal.p:pal.p2;
    ctx.globalAlpha=0.85*appear;
    ctx.fill();
    // petits pétales
    for (let j=0;j<4;j++) {
      ctx.save(); ctx.rotate((Math.PI*2/4)*j);
      ctx.beginPath(); ctx.ellipse(gs*0.5,0,gs*0.5,gs*0.2,0,0,Math.PI*2);
      ctx.fillStyle=pal.p2; ctx.globalAlpha=0.5*appear; ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawClochette(f, cx, cy, progress, size) {
  const pal = f.palette;
  const open = easeInOutCubic(Math.min(progress*1.2,1));

  ctx.save(); ctx.translate(cx,cy);
  ctx.rotate(Math.sin(time*1.5+f.seed)*0.15*f.swayAmp); // oscillation naturelle

  const h = size*(0.9+open*0.3);
  const w = size*(0.55+open*0.25);

  // cloche
  const bg = ctx.createLinearGradient(-w,0,w,0);
  bg.addColorStop(0, pal.p2);
  bg.addColorStop(0.4, pal.p);
  bg.addColorStop(1, pal.p2+'aa');
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.bezierCurveTo(-w*0.3,-h*0.2,-w*0.9,-h*0.5,-w*0.7,-h);
  ctx.bezierCurveTo(-w*0.4,-h*1.1,w*0.4,-h*1.1,w*0.7,-h);
  ctx.bezierCurveTo(w*0.9,-h*0.5,w*0.3,-h*0.2,0,0);
  ctx.fillStyle=bg; ctx.globalAlpha=0.88; ctx.fill();

  // nervures intérieures
  ctx.globalAlpha=0.25;
  ctx.strokeStyle=pal.p2; ctx.lineWidth=size*0.04*f.sc;
  for (let i=-1;i<=1;i++) {
    ctx.beginPath();
    ctx.moveTo(i*w*0.2, -h*0.1);
    ctx.bezierCurveTo(i*w*0.25,-h*0.5,i*w*0.35,-h*0.8,i*w*0.3,-h*0.95);
    ctx.stroke();
  }

  // pistil
  if (open>0.4) {
    ctx.globalAlpha=(open-0.4)/0.6;
    ctx.beginPath();
    ctx.moveTo(0,-h*0.3); ctx.lineTo(0,-h*0.8);
    ctx.strokeStyle=pal.c; ctx.lineWidth=size*0.05*f.sc; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-h*0.82,size*0.07,0,Math.PI*2);
    ctx.fillStyle=pal.c; ctx.fill();
  }

  ctx.restore();
}

/* ══ DRAW FLOWER WRAPPER ══ */
function drawFlower(f) {
  // croissance continue et fluide
  if (f.progress < 1) {
    f.progress += f.growSpeed * (1-f.progress*0.5);
    f.progress = Math.min(f.progress, 1);
  }
  f.h = f.maxH * easeOutQuart(f.progress);

  const sway = Math.sin(time*1.3+f.sway)*f.swayAmp*f.sc + wind*18*f.sc;
  // la tige se courbe progressivement
  const swayAtTop = sway * easeOutQuart(f.progress);
  const tx = f.x + swayAtTop;
  const ty = f.y - f.h;

  // tige + feuilles
  drawStem(f, tx, ty, f.progress);

  // fleur — apparaît à partir de 40% de la croissance
  const flowerProgress = Math.max(0, (f.progress - 0.38) / 0.62);
  if (flowerProgress <= 0) return;

  const fp = easeInOutCubic(flowerProgress);
  const fsize = f.size * fp;
  if (fsize < 0.5) return;

  ctx.save();
  ctx.globalAlpha = fp;

  switch(f.type) {
    case 0: drawRose(f, tx, ty, fp, fsize); break;
    case 1: drawMarguerite(f, tx, ty, fp, fsize); break;
    case 2: drawTulipe(f, tx, ty, fp, fsize); break;
    case 3: drawLavande(f, tx, ty, fp, fsize); break;
    case 4: drawClochette(f, tx, ty, fp, fsize); break;
  }

  ctx.restore();
}

function drawSky() {
  const g = ctx.createLinearGradient(0,0,0,horizon());
  g.addColorStop(0,'#3d8fd1'); g.addColorStop(0.45,'#87ceeb'); g.addColorStop(1,'#c8f0c8');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,horizon()+2);

  const glow = ctx.createLinearGradient(0,horizon()*0.65,0,horizon());
  glow.addColorStop(0,'rgba(255,220,150,0)'); glow.addColorStop(1,'rgba(255,220,120,0.18)');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,horizon());

  const hp=horizon();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(0,hp);
  ctx.bezierCurveTo(W*0.1,hp-60,W*0.25,hp-80,W*0.35,hp-45);
  ctx.bezierCurveTo(W*0.45,hp-15,W*0.55,hp-70,W*0.65,hp-90);
  ctx.bezierCurveTo(W*0.75,hp-110,W*0.85,hp-55,W,hp-30);
  ctx.lineTo(W,hp); ctx.closePath(); ctx.fillStyle='#2d7a4a'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0,hp);
  ctx.bezierCurveTo(W*0.05,hp-30,W*0.2,hp-50,W*0.3,hp-25);
  ctx.bezierCurveTo(W*0.4,hp-5,W*0.5,hp-40,W*0.6,hp-55);
  ctx.bezierCurveTo(W*0.72,hp-65,W*0.85,hp-35,W,hp-20);
  ctx.lineTo(W,hp); ctx.closePath(); ctx.fillStyle='#3a8f56'; ctx.fill();
  ctx.restore();
}

function drawGround() {
  const g = ctx.createLinearGradient(0,horizon(),0,H);
  g.addColorStop(0,'hsl(115,30%,17%)'); g.addColorStop(0.35,'hsl(118,36%,21%)'); g.addColorStop(1,'hsl(122,42%,27%)');
  ctx.fillStyle=g; ctx.fillRect(0,horizon(),W,H-horizon());
}

function drawClouds() {
  clouds.forEach(cl=>{
    cl.x+=cl.speed; if(cl.x>W+150) cl.x=-150;
    ctx.save(); ctx.globalAlpha=cl.alpha;
    cl.puffs.forEach(p=>{ ctx.beginPath(); ctx.arc(cl.x+p.dx,cl.y+p.dy,p.r,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fill(); });
    ctx.restore();
  });
}

function drawBirds() {
  birds.forEach(b=>{
    b.x+=b.speed; if(b.x>W+20) b.x=-20;
    const flap=Math.sin(time*4+b.phase)*b.size*0.5;
    ctx.save(); ctx.strokeStyle='rgba(30,30,60,0.7)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(b.x-b.size,b.y+flap); ctx.quadraticCurveTo(b.x,b.y-flap*0.5,b.x+b.size,b.y+flap); ctx.stroke(); ctx.restore();
  });
}

function drawPlayer() {
  const sc=scaleAt(player.y);
  const bounce=player.moving?Math.abs(Math.sin(time*10))*8*sc:0;
  ctx.save(); ctx.translate(player.x,player.y-bounce); ctx.scale(player.dir*sc,sc);
  ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0,6,20,7,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#c8a96e'; ctx.beginPath(); ctx.moveTo(-18,-10); ctx.bezierCurveTo(-22,0,-18,15,-8,18); ctx.lineTo(8,18); ctx.bezierCurveTo(18,15,22,0,18,-10); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#7c5c3a'; ctx.beginPath(); ctx.roundRect(-12,-32,24,24,[2,2,8,8]); ctx.fill();
  ctx.fillStyle='#e74c3c'; ctx.beginPath(); ctx.roundRect(-13,-32,26,6,3); ctx.fill();
  ctx.fillStyle='#f5cba0'; ctx.beginPath(); ctx.roundRect(-14,-60,28,30,10); ctx.fill();
  ctx.fillStyle='#3d2305'; ctx.beginPath(); ctx.roundRect(-14,-60,28,12,[10,10,0,0]); ctx.fill(); ctx.beginPath(); ctx.roundRect(-16,-58,6,18,4); ctx.fill();
  ctx.fillStyle='#2c2c2c'; ctx.beginPath(); ctx.arc(6,-43,2.5,0,Math.PI*2); ctx.arc(-6,-43,2.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(7,-44.2,1,0,Math.PI*2); ctx.arc(-5,-44.2,1,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff6b81'; ctx.globalAlpha=0.3; ctx.beginPath(); ctx.arc(12,-38,5,0,Math.PI*2); ctx.arc(-12,-38,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  ctx.fillStyle='#7c5c3a'; ctx.beginPath(); ctx.roundRect(12,-26,10,18,4); ctx.fill();
  if (tool==='plant') {
    ctx.fillStyle='#7ec8e3'; ctx.beginPath(); ctx.roundRect(18,-28,10,14,3); ctx.fill();
    ctx.beginPath(); ctx.arc(20,-28,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(25,-30,3,0,Math.PI*2); ctx.fill();
  } else {
    ctx.strokeStyle='#888'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(18,-30); ctx.lineTo(28,-18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28,-30); ctx.lineTo(18,-18); ctx.stroke();
  }
  ctx.restore();
}

function drawPetals() {
  petals=petals.filter(p=>p.life>0);
  petals.forEach(p=>{
    p.x+=p.vx+wind*1.2; p.y+=p.vy; p.vy+=0.035; p.vx*=0.98;
    p.rot+=p.rotSpeed; p.life-=0.006; p.alpha=easeOutQuart(p.life);
    if(p.y>H) p.life=0;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.ellipse(0,0,p.size,p.size*0.45,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

let mouse={x:0,y:0};
canvas.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});

function handleTap(x,y) {
  if(y<horizon()) return;
  if(tool==='plant') { createFlower(x,y); }
  else {
    flowers=flowers.filter(f=>{
      const dist=Math.hypot(f.x-x,(f.y-f.h*0.5)-y);
      if(dist<55){spawnPetal(f);return false;}
      return true;
    });
  }
}
canvas.addEventListener('click',e=>handleTap(e.clientX,e.clientY));
canvas.addEventListener('touchstart',e=>{e.preventDefault();const t=e.touches[0];handleTap(t.clientX,t.clientY);},{passive:false});
window.addEventListener('resize',initScene);

function frame() {
  time+=0.016;
  wind=Math.sin(time*0.5)*0.6+Math.sin(time*1.1)*0.25;

  player.moving=false; const spd=5;
  if(keys['KeyW']||keys['ArrowUp'])    {player.vy-=spd*0.55;player.moving=true;}
  if(keys['KeyS']||keys['ArrowDown'])  {player.vy+=spd*0.55;player.moving=true;}
  if(keys['KeyA']||keys['ArrowLeft'])  {player.vx-=spd;player.dir=-1;player.moving=true;}
  if(keys['KeyD']||keys['ArrowRight']) {player.vx+=spd;player.dir=1;player.moving=true;}
  player.vx*=0.82; player.vy*=0.82;
  player.x+=player.vx; player.y+=player.vy;
  player.x=Math.max(25,Math.min(W-25,player.x));
  player.y=Math.max(horizon()+15,Math.min(H-8,player.y));

  const pRow=rowOf(player.y);

  if(Math.random()<0.012) {
    const bloomed=flowers.filter(f=>f.progress>0.85);
    if(bloomed.length>0) spawnPetal(bloomed[Math.floor(Math.random()*bloomed.length)]);
  }

  ctx.clearRect(0,0,W,H);
  drawSky(); drawGround(); drawClouds(); drawBirds();

  for(let r=0;r<ROWS;r++) {
    blades.filter(b=>b.row===r).forEach(b=>{
      const sw=Math.sin(time*1.8+b.offset)*7*b.sc+wind*22*b.sc;
      ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.quadraticCurveTo(b.x+wind*5,b.y-b.h*0.55,b.x+sw,b.y-b.h);
      ctx.strokeStyle=`hsl(${b.hue},${b.sat}%,${b.lit}%)`; ctx.lineWidth=b.w; ctx.lineCap='round'; ctx.stroke();
    });
    flowers.filter(f=>f.row===r).forEach(f=>drawFlower(f));
    if(r===pRow) drawPlayer();
  }

  drawPetals();

  if(tool==='cut'&&!isMobile()) { ctx.font='28px serif'; ctx.fillText('✂️',mouse.x-8,mouse.y+8); }

  requestAnimationFrame(frame);
}

initScene();
frame();
