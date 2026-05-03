import * as THREE from 'three';
import { World } from './world';

const RAMP_START = 10;
const RAMP_FULL = 120;

const MAX_FRAGMENTS = 80;
const FRAGMENT_GEO = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const FRAGMENT_MAT = new THREE.MeshStandardMaterial({
    color: 0x0a0a12,
    roughness: 1,
    metalness: 0,
});

interface Fragment {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
}

export class Corruption {
    intensity = 0;

    private scene: THREE.Scene;
    private fragments: Fragment[] = [];
    private glitchTimer = 0;
    glitchActive = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    update(elapsed: number, dt: number, world: World) {
        // Intensity ramp 0 → 1
        if (elapsed < RAMP_START) {
            this.intensity = 0;
        } else {
            this.intensity = Math.min(
                (elapsed - RAMP_START) / (RAMP_FULL - RAMP_START),
                1,
            );
        }

        world.applyCorruption(this.intensity);

        // Darken & jitter obstacles
        for (const obs of world.obstacles) {
            const mat = obs.material as THREE.MeshStandardMaterial;
            mat.color.lerp(new THREE.Color(0x1a1820), this.intensity * 0.01);

            if (this.intensity > 0.3) {
                const jitter = (Math.random() - 0.5) * this.intensity * 0.06;
                obs.scale.x = 1 + jitter;
                obs.scale.z = 1 + jitter;
            }
        }

        // Floating dark fragments near the player (who sits at origin)
        if (this.intensity > 0.1) {
            const spawnRate = this.intensity * 3;
            if (Math.random() < spawnRate * dt) {
                this.spawnFragment();
            }
        }

        // Update fragments
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const frag = this.fragments[i];
            frag.mesh.position.add(frag.velocity.clone().multiplyScalar(dt));
            frag.mesh.rotation.x += dt * 2;
            frag.mesh.rotation.y += dt * 3;
            frag.life -= dt;
            const mat = frag.mesh.material as THREE.MeshStandardMaterial;
            mat.opacity = Math.max(frag.life / 3, 0);
            if (frag.life <= 0) {
                this.scene.remove(frag.mesh);
                this.fragments.splice(i, 1);
            }
        }

        // Glitch flicker
        this.glitchTimer -= dt;
        if (this.glitchTimer <= 0 && this.intensity > 0.2) {
            if (Math.random() < this.intensity * 0.3) {
                this.glitchActive = true;
                this.glitchTimer = 0.05 + Math.random() * 0.1;
            } else {
                this.glitchActive = false;
                this.glitchTimer = 0.2 + Math.random() * 0.5;
            }
        }

        // Fog & sky darkening
        const fog = this.scene.fog as THREE.FogExp2;
        fog.density = 0.012 + this.intensity * 0.018;
        const bgColor = this.scene.background as THREE.Color;
        bgColor.lerp(new THREE.Color(0x2a3040), this.intensity * 0.006);
    }

    dispose() {
        for (const frag of this.fragments) {
            this.scene.remove(frag.mesh);
        }
        this.fragments = [];
        this.intensity = 0;
        this.glitchActive = false;
        this.glitchTimer = 0;
    }

    private spawnFragment() {
        if (this.fragments.length >= MAX_FRAGMENTS) return;

        const mesh = new THREE.Mesh(FRAGMENT_GEO, FRAGMENT_MAT.clone());
        (mesh.material as THREE.MeshStandardMaterial).transparent = true;

        // Spawn around the player (who stays near origin)
        mesh.position.set(
            (Math.random() - 0.5) * 12,
            1 + Math.random() * 3,
            -3 - Math.random() * 10,
        );
        mesh.scale.setScalar(0.5 + Math.random() * 1.5);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            0.3 + Math.random() * 0.4,
            (Math.random() - 0.5) * 0.3,
        );

        this.scene.add(mesh);
        this.fragments.push({ mesh, velocity, life: 2 + Math.random() * 3 });
    }
}
