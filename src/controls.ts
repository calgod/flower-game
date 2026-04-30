/**
 * Captures keyboard input and exposes a lateral direction value (−1 … +1).
 */
export class Controls {
    private keys = new Set<string>();

    constructor() {
        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    }

    /** Returns −1 (left), 0 (none), or +1 (right). */
    get lateral(): number {
        let dir = 0;
        if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
        if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
        return dir;
    }
}
