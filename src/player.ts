import * as THREE from 'three';
import { SPHERE_RADIUS } from './world';

const BASE_SPEED = 8;
const MAX_SPEED = 28;
const SPEED_RAMP = 0.15;
const LATERAL_SPEED = 14;
const LATERAL_LIMIT = 10;
const SMOOTHING = 10;

export class Player {
    mesh: THREE.Group;
    speed: number = BASE_SPEED;
    distance = 0;

    private targetX = 0;
    private currentX = 0;
    private leftArm!: THREE.Mesh;
    private rightArm!: THREE.Mesh;
    private leftLeg!: THREE.Mesh;
    private rightLeg!: THREE.Mesh;

    constructor(scene: THREE.Scene) {
        this.mesh = new THREE.Group();
        this.buildCharacter();
        // Shift character down so feet sit on the ground (shoe bottom = 0.38)
        this.mesh.position.y = -0.38;
        scene.add(this.mesh);
    }

    private buildCharacter() {
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: 0x4488cc });
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2716 });

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skinMat);
        head.position.y = 1.65;
        head.castShadow = true;
        this.mesh.add(head);

        // Hair
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hairMat);
        hair.position.set(0, 1.72, 0.02);
        hair.scale.set(1, 0.8, 1);
        this.mesh.add(hair);

        // Torso
        const torso = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.55, 0.25),
            shirtMat
        );
        torso.position.y = 1.2;
        torso.castShadow = true;
        this.mesh.add(torso);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
        this.leftArm = new THREE.Mesh(armGeo, shirtMat);
        this.leftArm.position.set(-0.28, 1.18, 0);
        this.leftArm.castShadow = true;
        this.mesh.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, shirtMat);
        this.rightArm.position.set(0.28, 1.18, 0);
        this.rightArm.castShadow = true;
        this.mesh.add(this.rightArm);

        // Hands
        const handGeo = new THREE.SphereGeometry(0.06, 6, 4);
        const lHand = new THREE.Mesh(handGeo, skinMat);
        lHand.position.set(-0.28, 0.9, 0);
        this.mesh.add(lHand);
        const rHand = new THREE.Mesh(handGeo, skinMat);
        rHand.position.set(0.28, 0.9, 0);
        this.mesh.add(rHand);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.14, 0.45, 0.14);
        this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
        this.leftLeg.position.set(-0.1, 0.68, 0);
        this.leftLeg.castShadow = true;
        this.mesh.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
        this.rightLeg.position.set(0.1, 0.68, 0);
        this.rightLeg.castShadow = true;
        this.mesh.add(this.rightLeg);

        // Shoes
        const shoeGeo = new THREE.BoxGeometry(0.15, 0.08, 0.22);
        const lShoe = new THREE.Mesh(shoeGeo, shoeMat);
        lShoe.position.set(-0.1, 0.42, -0.03);
        this.mesh.add(lShoe);
        const rShoe = new THREE.Mesh(shoeGeo, shoeMat);
        rShoe.position.set(0.1, 0.42, -0.03);
        this.mesh.add(rShoe);
    }

    update(dt: number, lateral: number, elapsed: number) {
        // Ramp speed over time
        this.speed = Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED);
        this.distance += this.speed * dt;

        // Lateral only — player stays at z=0 on top of the sphere
        this.targetX += lateral * LATERAL_SPEED * dt;
        this.targetX = THREE.MathUtils.clamp(this.targetX, -LATERAL_LIMIT, LATERAL_LIMIT);
        this.currentX = THREE.MathUtils.lerp(this.currentX, this.targetX, SMOOTHING * dt);
        this.mesh.position.x = this.currentX;

        // Follow sphere curvature: y = -R + sqrt(R² - x²)
        this.mesh.position.y = -SPHERE_RADIUS + Math.sqrt(SPHERE_RADIUS * SPHERE_RADIUS - this.currentX * this.currentX) - 0.38;

        // Slight lean when moving laterally
        this.mesh.rotation.z = -lateral * 0.12;

        // Running animation — swing arms & legs
        const swing = Math.sin(this.distance * 0.8) * 0.5;
        this.leftArm.rotation.x = swing;
        this.rightArm.rotation.x = -swing;
        this.leftLeg.rotation.x = -swing * 0.7;
        this.rightLeg.rotation.x = swing * 0.7;
    }

    reset() {
        this.targetX = 0;
        this.currentX = 0;
        this.mesh.position.set(0, -0.38, 0);
        this.speed = BASE_SPEED;
        this.distance = 0;
    }
}
