import * as THREE from 'three';
import { PLAYER_LATERAL_LIMIT, SPHERE_RADIUS } from './gameConstants';

// ── Configuration ──────────────────────────────────────────
export { SPHERE_RADIUS };
const SEGMENT_ANGLE = 0.2;        // radians per segment (~12 units of arc)
const SPAWN_AHEAD = 1.0;          // how far ahead to spawn (radians)
const KEEP_BEHIND = 0.4;          // how far behind before recycling
const FLOWERS_PER_SEGMENT = 14;
const FLOWER_SPREAD_X = 14;
const MAX_OBSTACLES_PER_SEG = 3;
const SAFE_ANGLE = 0.2;           // brief opening before obstacles begin
const OBSTACLE_LANE_EDGE_INSET = 0.4;
const OBSTACLE_LANE_JITTER = 0.45;

const OBSTACLE_LANES = [
    -(PLAYER_LATERAL_LIMIT - OBSTACLE_LANE_EDGE_INSET),
    -PLAYER_LATERAL_LIMIT * 0.5,
    0,
    PLAYER_LATERAL_LIMIT * 0.5,
    PLAYER_LATERAL_LIMIT - OBSTACLE_LANE_EDGE_INSET,
];

const HEALTHY_GRASS_COLOR = new THREE.Color(0x5a8f4a);
const DEAD_GRASS_COLOR = new THREE.Color(0x72683b);
const CHARRED_GRASS_COLOR = new THREE.Color(0x2d261d);
const HEALTHY_STEM_COLOR = new THREE.Color(0x3a7d34);
const DEAD_STEM_COLOR = new THREE.Color(0x5b5130);
const CHARRED_STEM_COLOR = new THREE.Color(0x2f291f);
const ROTTED_PETAL_COLOR = new THREE.Color(0x35232e);
const CHARRED_PETAL_COLOR = new THREE.Color(0x1a1418);

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
    baseScale: number;
    petalMat: THREE.MeshStandardMaterial;
    stemMat: THREE.MeshStandardMaterial;
    petalBaseColor: THREE.Color;
    wiltAxis: THREE.Vector3;
    wiltStrength: number;
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
    private sphereMat: THREE.MeshStandardMaterial;
    private surfaceGroup: THREE.Group;
    private segments: Segment[] = [];
    private nextSegmentAngle: number;
    private rotation = 0;
    private segmentsUntilNextObstacle = 0;
    private pressureLane = 2;
    private lastPatternKey = '';
    private corruptionIntensity = 0;

    /** Active obstacles — exposed for collision checks. */
    obstacles: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Ground sphere
        const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 48);
        this.sphereMat = new THREE.MeshStandardMaterial({ color: HEALTHY_GRASS_COLOR.clone(), roughness: 0.9 });
        this.sphere = new THREE.Mesh(sphereGeo, this.sphereMat);
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
        const wiltQuat = new THREE.Quaternion();
        for (const seg of this.segments) {
            for (const f of seg.flowers) {
                const sway = Math.sin(elapsed * 1.5 + f.phase) * 0.08;
                swayEuler.set(sway * 0.5, 0, sway);
                swayQuat.setFromEuler(swayEuler);
                const wiltAngle = this.corruptionIntensity * f.wiltStrength * 1.15;
                wiltQuat.setFromAxisAngle(f.wiltAxis, wiltAngle);
                f.mesh.quaternion.copy(f.baseQuat).multiply(swayQuat).multiply(wiltQuat);

                const widthScale = 1 - this.corruptionIntensity * 0.2;
                const heightScale = 1 - this.corruptionIntensity * 0.38;
                f.mesh.scale.set(
                    f.baseScale * widthScale,
                    f.baseScale * heightScale,
                    f.baseScale * widthScale,
                );
            }
        }
    }

    applyCorruption(intensity: number) {
        this.corruptionIntensity = intensity;

        const groundDryness = Math.min(intensity * 1.35, 1);
        const groundChar = THREE.MathUtils.clamp((intensity - 0.65) / 0.35, 0, 0.55);
        this.sphereMat.color.copy(HEALTHY_GRASS_COLOR).lerp(DEAD_GRASS_COLOR, groundDryness);
        this.sphereMat.color.lerp(CHARRED_GRASS_COLOR, groundChar);
        this.sphereMat.roughness = 0.88 + intensity * 0.1;

        for (const seg of this.segments) {
            for (const f of seg.flowers) {
                const petalRot = Math.min(intensity * 1.1, 1);
                const petalChar = THREE.MathUtils.clamp((intensity - 0.6) / 0.4, 0, 0.72);
                f.petalMat.color.copy(f.petalBaseColor).lerp(ROTTED_PETAL_COLOR, petalRot);
                f.petalMat.color.lerp(CHARRED_PETAL_COLOR, petalChar);
                f.petalMat.roughness = 0.7 + intensity * 0.25;

                const stemDryness = Math.min(intensity * 1.2, 1);
                const stemChar = THREE.MathUtils.clamp((intensity - 0.65) / 0.35, 0, 0.65);
                f.stemMat.color.copy(HEALTHY_STEM_COLOR).lerp(DEAD_STEM_COLOR, stemDryness);
                f.stemMat.color.lerp(CHARRED_STEM_COLOR, stemChar);
                f.stemMat.roughness = 0.82 + intensity * 0.15;
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
            this.placeOnSurface(flower.mesh, fAngle, fx, -0.05);
            const baseQuat = flower.mesh.quaternion.clone();
            this.surfaceGroup.add(flower.mesh);
            flowers.push({ ...flower, baseQuat, phase: Math.random() * Math.PI * 2 });
        }

        // Obstacles — spread across full playable width, spawn multiple
        if (angle > SAFE_ANGLE) {
            if (this.segmentsUntilNextObstacle > 0) {
                this.segmentsUntilNextObstacle--;
            } else {
                const positions = this.getObstaclePositions(angle);
                for (const ox of positions) {
                    const oAngle = angle + Math.random() * SEGMENT_ANGLE;
                    const obs = new THREE.Mesh(obstacleGeo, obstacleMat.clone());
                    this.placeOnSurface(obs, oAngle, ox, 0.7);
                    obs.castShadow = true;
                    this.surfaceGroup.add(obs);
                    obstacles.push(obs);
                    this.obstacles.push(obs);
                }

                // Usually keep pressure on consecutive segments, with only brief breaks.
                this.segmentsUntilNextObstacle = Math.random() < 0.75 ? 0 : 1;
            }
        }

        this.segments.push({ angle, flowers, obstacles });
    }

    private removeSegment(seg: Segment) {
        for (const f of seg.flowers) {
            this.surfaceGroup.remove(f.mesh);
            f.petalMat.dispose();
            f.stemMat.dispose();
        }
        for (const obs of seg.obstacles) {
            this.surfaceGroup.remove(obs);
            (obs.material as THREE.Material).dispose();
            const idx = this.obstacles.indexOf(obs);
            if (idx !== -1) this.obstacles.splice(idx, 1);
        }
    }

    private getObstaclePositions(angle: number) {
        const count = this.pickObstacleCount(angle);
        const lanes = this.pickPatternLanes(count);
        this.lastPatternKey = lanes.join(',');
        return lanes.map((lane) => this.getLanePosition(lane));
    }

    private pickObstacleCount(angle: number) {
        const intensity = THREE.MathUtils.clamp((angle - SAFE_ANGLE) / 2.5, 0, 1);
        const roll = Math.random();
        const singleThreshold = 0.5 - intensity * 0.15;
        const doubleThreshold = 0.92 - intensity * 0.1;

        if (roll < singleThreshold) return 1;
        if (roll < doubleThreshold) return 2;
        return MAX_OBSTACLES_PER_SEG;
    }

    private pickPatternLanes(count: number) {
        const laneShift = this.pickLaneShift();
        this.pressureLane = THREE.MathUtils.clamp(this.pressureLane + laneShift, 0, 4);

        let lanes = this.buildPatternLanes(count);
        const patternKey = lanes.join(',');
        if (patternKey === this.lastPatternKey) {
            this.pressureLane = THREE.MathUtils.clamp(this.pressureLane + (this.pressureLane < 2 ? 1 : -1), 0, 4);
            lanes = this.buildPatternLanes(count);
        }

        return lanes;
    }

    private pickLaneShift() {
        const roll = Math.random();
        if (roll < 0.2) return 0;
        if (roll < 0.75) return Math.random() < 0.5 ? -1 : 1;
        return Math.random() < 0.5 ? -2 : 2;
    }

    private buildPatternLanes(count: number) {
        if (count === 1) return [this.pressureLane];

        if (count === 2) {
            if (Math.random() < 0.18) return [0, 4];
            if (this.pressureLane <= 0) return [0, 1];
            if (this.pressureLane >= 4) return [3, 4];

            const side = Math.random() < 0.5 ? -1 : 1;
            const partnerLane = THREE.MathUtils.clamp(this.pressureLane + side, 0, 4);
            return [Math.min(this.pressureLane, partnerLane), Math.max(this.pressureLane, partnerLane)];
        }

        if (Math.random() < 0.25) return [0, 2, 4];
        if (this.pressureLane <= 1) return [0, 1, 2];
        if (this.pressureLane >= 3) return [2, 3, 4];
        return [1, 2, 3];
    }

    private getLanePosition(laneIndex: number) {
        const laneX = OBSTACLE_LANES[laneIndex];
        const jitter = THREE.MathUtils.randFloat(-OBSTACLE_LANE_JITTER, OBSTACLE_LANE_JITTER);
        return THREE.MathUtils.clamp(
            laneX + jitter,
            -PLAYER_LATERAL_LIMIT,
            PLAYER_LATERAL_LIMIT,
        );
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

    private createFlower(): Omit<FlowerData, 'baseQuat' | 'phase'> {
        const group = new THREE.Group();

        const stemMaterial = stemMat.clone();
        const stem = new THREE.Mesh(stemGeo, stemMaterial);
        stem.position.y = 0.8;
        stem.castShadow = true;
        group.add(stem);

        const color = new THREE.Color(PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]);
        const petalMaterial = new THREE.MeshStandardMaterial({ color: color.clone(), roughness: 0.7 });
        const center = new THREE.Mesh(petalGeo, petalMaterial);
        center.position.y = 1.6;
        center.castShadow = true;
        group.add(center);

        for (let i = 0; i < 4; i++) {
            const p = new THREE.Mesh(petalGeo, petalMaterial);
            const a = (i / 4) * Math.PI * 2;
            p.position.set(Math.cos(a) * 0.12, 1.55, Math.sin(a) * 0.12);
            p.scale.setScalar(0.7);
            group.add(p);
        }

        const baseScale = 0.7 + Math.random() * 0.6;
        group.scale.setScalar(baseScale);

        const wiltDirection = Math.random() * Math.PI * 2;

        return {
            mesh: group,
            baseScale,
            petalMat: petalMaterial,
            stemMat: stemMaterial,
            petalBaseColor: color,
            wiltAxis: new THREE.Vector3(Math.cos(wiltDirection), 0, Math.sin(wiltDirection)),
            wiltStrength: 0.55 + Math.random() * 0.45,
        };
    }
}
