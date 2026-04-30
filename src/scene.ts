import * as THREE from 'three';

/**
 * Creates the Three.js scene with warm sunlight, ambient light, fog,
 * and a soft sky-gradient background.
 */
export function createScene() {
    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.getElementById('app')!.appendChild(renderer.domElement);

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // soft sky blue
    scene.fog = new THREE.FogExp2(0xddeeff, 0.012);  // gentle distance fog

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        500
    );

    // --- Lights ---
    // Warm directional sunlight
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    scene.add(sun);

    // Soft ambient fill
    const ambient = new THREE.AmbientLight(0x99bbff, 0.5);
    scene.add(ambient);

    // Hemisphere light for sky/ground color bleed
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.4);
    scene.add(hemi);

    // --- Resize handling ---
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { renderer, scene, camera, sun };
}
