import * as THREE from 'three';
import { createScene } from './scene';
import { Player } from './player';
import { Controls } from './controls';
import { World } from './world';
import { Corruption } from './corruption';
import { Music } from './music';

// ── Bootstrap ─────────────────────────────────────────────
const { renderer, scene, camera } = createScene();
const controls = new Controls();
const player = new Player(scene);
let world = new World(scene);
let corruption = new Corruption(scene);
const music = new Music();

// Start music on first user interaction
const startMusic = () => { music.start(); window.removeEventListener('keydown', startMusic); window.removeEventListener('click', startMusic); };
window.addEventListener('keydown', startMusic);
window.addEventListener('click', startMusic);

// ── HUD ───────────────────────────────────────────────────
const hud = document.getElementById('hud')!;
const overlay = document.getElementById('overlay')!;
const glitchOverlay = document.getElementById('glitch')!;
const finalScore = document.getElementById('final-score')!;
let gameOver = false;
let elapsed = 0;

// ── Camera (close third-person) ───────────────────────────
const CAM_OFFSET = new THREE.Vector3(0, 2.0, 3.5);
const CAM_LOOK_AHEAD = 4;
const CAM_SMOOTH = 4;

// ── Collision ─────────────────────────────────────────────
const tmpWorldPos = new THREE.Vector3();

function checkCollisions(): boolean {
    const px = player.mesh.position.x;
    const py = player.mesh.position.y;
    for (const obs of world.obstacles) {
        obs.getWorldPosition(tmpWorldPos);
        const dx = Math.abs(tmpWorldPos.x - px);
        const dy = Math.abs(tmpWorldPos.y - py);
        const dz = Math.abs(tmpWorldPos.z);
        if (dx < 0.8 && dy < 1.2 && dz < 1.0) return true;
    }
    return false;
}

// ── Restart ───────────────────────────────────────────────
function restart() {
    player.reset();

    world.dispose();
    world = new World(scene);

    corruption.dispose();
    corruption = new Corruption(scene);

    elapsed = 0;
    gameOver = false;
    overlay.classList.add('hidden');

    (scene.background as THREE.Color).set(0x87ceeb);
    (scene.fog as THREE.FogExp2).density = 0.012;
}

overlay.addEventListener('click', restart);
window.addEventListener('keydown', (e) => {
    if (gameOver && e.code === 'Space') restart();
});

// ── Game loop ─────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (gameOver) {
        renderer.render(scene, camera);
        return;
    }

    elapsed += dt;

    // Update systems
    player.update(dt, controls.lateral, elapsed, controls.consumeJump());
    corruption.update(elapsed, dt, world);
    world.update(dt, player.speed, elapsed);
    music.update(corruption.intensity);

    // Camera — smoothly follow player laterally, stay close behind
    const target = player.mesh.position.clone().add(CAM_OFFSET);
    camera.position.lerp(target, CAM_SMOOTH * dt);
    camera.lookAt(
        player.mesh.position.x,
        -0.3,
        -CAM_LOOK_AHEAD,
    );

    // Collision
    if (checkCollisions()) {
        gameOver = true;
        finalScore.textContent = `You survived ${elapsed.toFixed(1)} seconds`;
        overlay.classList.remove('hidden');
    }

    // Glitch overlay
    if (corruption.glitchActive) {
        glitchOverlay.style.opacity = (0.08 + Math.random() * 0.12).toString();
    } else {
        glitchOverlay.style.opacity = '0';
    }

    hud.textContent = `${elapsed.toFixed(1)}s`;
    renderer.render(scene, camera);
}

animate();
