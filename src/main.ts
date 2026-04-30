import * as THREE from 'three';
import { createScene } from './scene';
import { Player } from './player';
import { Controls } from './controls';
import { World } from './world';
import { Corruption } from './corruption';

// ── Bootstrap ─────────────────────────────────────────────
const { renderer, scene, camera } = createScene();
const controls = new Controls();
const player = new Player(scene);
let world = new World(scene);
let corruption = new Corruption(scene);

// ── HUD ───────────────────────────────────────────────────
const hud = document.getElementById('hud')!;
const overlay = document.getElementById('overlay')!;
const glitchOverlay = document.getElementById('glitch')!;
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
    for (const obs of world.obstacles) {
        obs.getWorldPosition(tmpWorldPos);
        const dx = Math.abs(tmpWorldPos.x - px);
        const dz = Math.abs(tmpWorldPos.z);
        const nearTop = tmpWorldPos.y > -1.0 && tmpWorldPos.y < 2.5;
        if (dx < 0.8 && dz < 1.0 && nearTop) return true;
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
    player.update(dt, controls.lateral, elapsed);
    world.update(dt, player.speed, elapsed);
    corruption.update(elapsed, dt, world);

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
