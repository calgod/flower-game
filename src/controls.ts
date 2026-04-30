/**
 * Captures keyboard, touch, and gyroscope input.
 */
export class Controls {
    private keys = new Set<string>();
    private _jumpPressed = false;
    private touchLateral = 0;
    private gyroLateral = 0;
    private gyroEnabled = false;

    constructor() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
            if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
                this._jumpPressed = true;
            }
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));

        // Touch buttons
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');

        if (btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchLateral = -1; }, { passive: false });
            btnLeft.addEventListener('touchend', () => { this.touchLateral = 0; });
            btnLeft.addEventListener('touchcancel', () => { this.touchLateral = 0; });
        }
        if (btnRight) {
            btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchLateral = 1; }, { passive: false });
            btnRight.addEventListener('touchend', () => { this.touchLateral = 0; });
            btnRight.addEventListener('touchcancel', () => { this.touchLateral = 0; });
        }
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); this._jumpPressed = true; }, { passive: false });
        }

        // Gyroscope — request permission on iOS, listen directly on Android
        this.initGyro();
    }

    private async initGyro() {
        const doe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        if (typeof doe.requestPermission === 'function') {
            // iOS 13+ requires a user gesture; we hook into the first touch
            const handler = async () => {
                try {
                    const perm = await doe.requestPermission!();
                    if (perm === 'granted') this.listenGyro();
                } catch { /* user denied */ }
                window.removeEventListener('touchstart', handler);
            };
            window.addEventListener('touchstart', handler, { once: true });
        } else if ('DeviceOrientationEvent' in window) {
            this.listenGyro();
        }
    }

    private listenGyro() {
        this.gyroEnabled = true;
        window.addEventListener('deviceorientation', (e) => {
            // gamma: left-right tilt in degrees (−90 to 90)
            const gamma = e.gamma ?? 0;
            // Dead zone ±5°, full tilt at ±30°
            const DEAD = 5;
            const MAX = 30;
            if (Math.abs(gamma) < DEAD) {
                this.gyroLateral = 0;
            } else {
                const sign = Math.sign(gamma);
                const clamped = Math.min(Math.abs(gamma) - DEAD, MAX - DEAD);
                this.gyroLateral = sign * (clamped / (MAX - DEAD));
            }
        });
    }

    /** Returns −1 (left) to +1 (right), smoothly. */
    get lateral(): number {
        // Touch buttons take highest priority
        if (this.touchLateral !== 0) return this.touchLateral;
        // Then keyboard
        let dir = 0;
        if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
        if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
        if (dir !== 0) return dir;
        // Then gyroscope (analog)
        if (this.gyroEnabled) return this.gyroLateral;
        return 0;
    }

    /** Consume jump input (returns true once per press). */
    consumeJump(): boolean {
        if (this._jumpPressed) {
            this._jumpPressed = false;
            return true;
        }
        return false;
    }
}
