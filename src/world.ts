import * as THREE from 'three';

// ── Configuration ──────────────────────────────────────────
const SPHERE_RADIUS = 60;
export { SPHERE_RADIUS };
const SEGMENT_ANGLE = 0.2;        // radians per segment (~12 units of arc)
const SPAWN_AHEAD = 1.0;          // how far ahead to spawn (radians)
const KEEP_BEHIND = 0.4;          // how far behind before recycling
const FLOWERS_PER_SEGMENT = 14;
const FLOWER_SPREAD_X = 14;
const OBSTACLE_CHANCE = 0.55;
const MAX_OBSTACLES_PER_SEG = 3;
const SAFE_ANGLE = 0.8;           // no obstacles for first ~48 units

// ── Shared geometry / materials ───────────────────────────
const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5);
const petalGeo = new THREE.SphereGeometry(0.18, 6, 4);
const obstacleGeo = new THREE.BoxGeometry(0.9, 1.4, 0.9);

const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7d34 });
const obstacleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
const PETAL_COLORS = [0xff6688, 0xffaa44, 0xeedd44, 0xff88cc, 0xffccee, 0xddaaff];

// ── Types ─────────────────────────────────────────────────
interface FlowerData {
    mesh: THREE.Group;
    baseQuat: THREE.Quaternion;
    phase: number;
}

interface Segment {
    angle: number;
    flowers: FlowerData[];
    obstacles: THREE.Mesh[];
}

// ── World ─────────────────────────────────────────────────
export class World {
    private scene: THREE.Scene;
    sphere: THREE.Mesh;
    private surfaceGroup: THREE.Group;
    private segments: Segment[] = [];
    private nextSegmentAngle: number;
    private rotation = 0;

    /** Active obstacles — exposed for collision checks. */
    obstacles: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Ground sphere
        const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 48);
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x5a8f4a, roughness: 0.9 });
        this.sphere = new THREE.Mesh(sphereGeo, sphereMat);
        this.sphere.position.y = -SPHERE_RADIUS;
        this.sphere.receiveShadow = true;
        scene.add(this.sphere);

        // Group for surface objects (flowers & obstacles) — rotates with sphere
        this.surfaceGroup = new THREE.Group();
        this.surfaceGroup.position.y = -SPHERE_RADIUS;
        scene.add(this.surfaceGroup);

        // Spawn initial ring of segments
        this.nextSegmentAngle = -KEEP_BEHIND;
        while (this.nextSegmentAngle < SPAWN_AHEAD) {
            this.spawnSegment();
        }
    }

    // ── Public API ──────────────────────────────────────────
    update(dt: number, speed: number, elapsed: number) {
        const angularVelocity = speed / SPHERE_RADIUS;
        this.rotation += angularVelocity * dt;

        this.sphere.rotation.x = this.rotation;
        this.surfaceGroup.rotation.x = this.rotation;

        // Spawn ahead
        while (this.nextSegmentAngle < this.rotation + SPAWN_AHEAD) {
            this.spawnSegment();
        }

        // Recycle behind
        while (
            this.segments.length > 0 &&
            this.segments[0].angle < this.rotation - KEEP_BEHIND
        ) {
            this.removeSegment(this.segments[0]);
            this.segments.shift();
        }

        // Flower sway
        const swayEuler = new THREE.Euler();
        const swayQuat = new THREE.Quaternion();
        for (const seg of this.segments) {
            for (const f of seg.flowers) {
                const sway = Math.sin(elapsed * 1.5 + f.phase) * 0.08;
                swayEuler.set(sway * 0.5, 0, sway);
                swayQuat.setFromEuler(swayEuler);
                f.mesh.quaternion.copy(f.baseQuat).multiply(swayQuat);
            }
        }
    }

    dispose() {
        for (const seg of this.segments) this.removeSegment(seg);
        this.segments = [];
        this.obstacles = [];
        this.scene.remove(this.sphere);
        this.scene.remove(this.surfaceGroup);
        this.sphere.geometry.dispose();
        (this.sphere.material as THREE.Material).dispose();
    }

    // ── Internals ───────────────────────────────────────────
    private spawnSegment() {
        const angle = this.nextSegmentAngle;
        this.nextSegmentAngle += SEGMENT_ANGLE;

        const flowers: FlowerData[] = [];
        const obstacles: THREE.Mesh[] = [];

        // Flowers
        for (let i = 0; i < FLOWERS_PER_SEGMENT; i++) {
            const fx = (Math.random() - 0.5) * FLOWER_SPREAD_X * 2;
            const fAngle = angle + Math.random() * SEGMENT_ANGLE;
            const flower = this.createFlower();
            this.placeOnSurface(flower, fAngle, fx, -0.05);
            const baseQuat = flower.quaternion.clone();
            this.surfaceGroup.add(flower);
            flowers.push({ mesh: flower, baseQuat, phase: Math.random() * Math.PI * 2 });
        }

        // Obstacles — spread across full playable width, spawn multiple
        if (angle > SAFE_ANGLE) {
            const count = Math.random() < OBSTACLE_CHANCE
                ? 1 + Math.floor(Math.random() * MAX_OBSTACLES_PER_SEG)
                : 0;
            for (let o = 0; o < count; o++) {
                const ox = (Math.random() - 0.5) * 18;
                const oAngle = angle + Math.random() * SEGMENT_ANGLE;
                const obs = new THREE.Mesh(obstacleGeo, obstacleMat.clone());
                this.placeOnSurface(obs, oAngle, ox, 0.7);
                obs.castShadow = true;
                this.surfaceGroup.add(obs);
                obstacles.push(obs);
                this.obstacles.push(obs);
            }
        }

        this.segments.push({ angle, flowers, obstacles });
    }

    private removeSegment(seg: Segment) {
        for (const f of seg.flowers) this.surfaceGroup.remove(f.mesh);
        for (const obs of seg.obstacles) {
            this.surfaceGroup.remove(obs);
            const idx = this.obstacles.indexOf(obs);
            if (idx !== -1) this.obstacles.splice(idx, 1);
        }
    }

    private placeOnSurface(
        obj: THREE.Object3D,
        angle: number,
        x: number,
        heightOffset = 0,
    ) {
        // Convert lateral x to an arc-angle on the sphere
        const phi = x / SPHERE_RADIUS;
        const r = SPHERE_RADIUS + heightOffset;
        obj.position.set(
            r * Math.sin(phi),
            r * Math.cos(angle) * Math.cos(phi),
            -r * Math.sin(angle) * Math.cos(phi),
        );

        // Orient so local Y points outward from sphere center
        const outward = obj.position.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        obj.quaternion.setFromUnitVectors(up, outward);
    }

    private createFlower(): THREE.Group {
        const group = new THREE.Group();

        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.8;
        stem.castShadow = true;
        group.add(stem);

        const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
        const pMat = new THREE.MeshStandardMaterial({ color });
        const center = new THREE.Mesh(petalGeo, pMat);
        center.position.y = 1.6;
        center.castShadow = true;
        group.add(center);

        for (let i = 0; i < 4; i++) {
            const p = new THREE.Mesh(petalGeo, pMat);
            const a = (i / 4) * Math.PI * 2;
            p.position.set(Math.cos(a) * 0.12, 1.55, Math.sin(a) * 0.12);
            p.scale.setScalar(0.7);
            group.add(p);
        }

        group.scale.setScalar(0.7 + Math.random() * 0.6);
        return group;
    }
}
