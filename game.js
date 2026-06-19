// Brisket Battles - HTML5 Canvas Ragdoll Physics Game

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// --- VERLET PHYSICS ENGINE ---
class Point {
    constructor(x, y, pinned = false) {
        this.x = x; this.y = y;
        this.px = x; this.py = y;
        this.pinned = pinned;
    }
    update() {
        if (this.pinned) return;
        let vx = (this.x - this.px) * 0.99; // Friction
        let vy = (this.y - this.py) * 0.99;
        this.px = this.x; this.py = this.y;
        this.x += vx; this.y += vy + 0.5; // Gravity
    }
}

class Stick {
    constructor(p1, p2, length = null) {
        this.p1 = p1; this.p2 = p2;
        this.length = length || Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    update() {
        let dx = this.p2.x - this.p1.x;
        let dy = this.p2.y - this.p1.y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        let diff = (this.length - dist) / dist * 0.5;
        let ox = dx * diff;
        let oy = dy * diff;
        if (!this.p1.pinned) { this.p1.x -= ox; this.p1.y -= oy; }
        if (!this.p2.pinned) { this.p2.x += ox; this.p2.y += oy; }
    }
}

// --- RAGDOLL BUTCHER ---
class Butcher {
    constructor(x, y, color, isPlayer1) {
        this.color = color;
        this.isPlayer1 = isPlayer1;
        this.hp = 100;
        this.weaponCooldown = 0;
        
        // Create ragdoll points
        this.head = new Point(x, y - 40);
        this.torso = new Point(x, y);
        this.leftHand = new Point(x - 20, y + 10);
        this.rightHand = new Point(x + 20, y + 10); // Weapon hand
        this.leftFoot = new Point(x - 10, y + 50);
        this.rightFoot = new Point(x + 10, y + 50);
        
        this.points = [this.head, this.torso, this.leftHand, this.rightHand, this.leftFoot, this.rightFoot];
        
        // Create bones (sticks)
        this.sticks = [
            new Stick(this.head, this.torso),
            new Stick(this.torso, this.leftHand, 25),
            new Stick(this.torso, this.rightHand, 25),
            new Stick(this.torso, this.leftFoot, 45),
            new Stick(this.torso, this.rightFoot, 45),
            // Keep arms somewhat rigid
            new Stick(this.head, this.leftHand, 50),
            new Stick(this.head, this.rightHand, 50)
        ];
    }
    
    moveLeft() { this.torso.x -= 2; this.torso.px -= 1; }
    moveRight() { this.torso.x += 2; this.torso.px += 1; }
    jump() { if (Math.abs(this.torso.y - this.torso.py) < 1) this.torso.py += 8; }
    
    swingWeapon() {
        if (this.weaponCooldown > 0) return;
        this.weaponCooldown = 30; // frames
        // Apply sudden velocity to the weapon hand
        this.rightHand.px = this.rightHand.x - 25;
        this.rightHand.py = this.rightHand.y + 10;
    }

    update() {
        if (this.weaponCooldown > 0) this.weaponCooldown--;
        
        // Floor collision
        this.points.forEach(p => {
            p.update();
            if (p.y > canvas.height - 20) {
                p.y = canvas.height - 20;
                p.py = p.y + (p.y - p.py) * 0.5; // Bounce
            }
             if (p.x < 0) p.x = 0;
             if (p.x > canvas.width) p.x = canvas.width;
        });
        
        // Solve constraints multiple times for stability
        for (let i = 0; i < 5; i++) {
            this.sticks.forEach(s => s.update());
        }
    }

    draw(ctx) {
        // Draw bones
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 8;
        this.sticks.forEach(s => {
            ctx.beginPath();
            ctx.moveTo(s.p1.x, s.p1.y);
            ctx.lineTo(s.p2.x, s.p2.y);
            ctx.stroke();
        });
        
        // Draw head
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.head.x, this.head.y, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Brisket Weapon (Brown meaty rectangle)
        let w = this.rightHand;
        let angle = Math.atan2(w.y - this.torso.y, w.x - this.torso.x);
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#5a2d0c'; // Brisket color
        ctx.fillRect(0, -8, 35, 16); // Thick meaty block
        // Fat marbling
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(5, -5, 4, 10);
        ctx.fillRect(15, -5, 4, 10);
        ctx.fillRect(25, -5, 4, 10);
        ctx.restore();
    }
}

// --- GAME SETUP ---
let p1 = new Butcher(200, 300, '#00aaff', true);
let p2 = new Butcher(600, 300, '#ff4444', false);
let p1Score = 0, p2Score = 0;

const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; if(e.key === ' ') e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key] = false; });

function handleInput() {
    // P1 Controls
    if (keys['a']) p1.moveLeft();
    if (keys['d']) p1.moveRight();
    if (keys['w']) p1.jump();
    if (keys[' ']) p1.swingWeapon();
    
    // P2 Controls
    if (keys['ArrowLeft']) p2.moveLeft();
    if (keys['ArrowRight']) p2.moveRight();
    if (keys['ArrowUp']) p2.jump();
    if (keys['Enter']) p2.swingWeapon();
}

function checkCombat(attacker, defender) {
    if (attacker.weaponCooldown > 25) { // Active swing frame
        let dx = attacker.rightHand.x - defender.torso.x;
        let dy = attacker.rightHand.y - defender.torso.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist < 50) {
            // HIT!
            defender.hp -= 5;
            let knockback = 15;
            let angle = Math.atan2(dy, dx);
            defender.torso.x -= Math.cos(angle) * knockback * -1; // Away from attacker
            defender.torso.y -= Math.sin(angle) * knockback * -1 - 5; // Pop up
            defender.head.x -= Math.cos(angle) * knockback * -1.5;
            defender.head.y -= Math.sin(angle) * knockback * -1.5 - 5;
            
            if (defender.hp <= 0) {
                if (defender.isPlayer1) p2Score++;
                else p1Score++;
                defender.hp = 100;
                // Reset positions
                p1.torso.x = 200; p1.torso.y = 300;
                p2.torso.x = 600; p2.torso.y = 300;
            }
        }
    }
}

function drawGround() {
    ctx.fillStyle = '#2d1c10';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    handleInput();
    
    p1.update();
    p2.update();
    
    checkCombat(p1, p2);
    checkCombat(p2, p1);
    
    drawGround();
    p1.draw(ctx);
    p2.draw(ctx);
    
    // Update UI
    document.getElementById('p1-health').innerText = `P1 HP: ${Math.max(0, p1.hp)}`;
    document.getElementById('p2-health').innerText = `P2 HP: ${Math.max(0, p2.hp)}`;
    
    requestAnimationFrame(gameLoop);
}

gameLoop();
