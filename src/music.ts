/**
 * Procedural ambient music using Web Audio API.
 * A calm, evolving pad that darkens with corruption.
 */

const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0]; // C4 pentatonic

export class Music {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private padOscs: OscillatorNode[] = [];
    private padGains: GainNode[] = [];
    private filterNode: BiquadFilterNode | null = null;
    private nextNoteTime = 0;
    private arpIndex = 0;
    private started = false;

    /** Call on first user interaction to unlock AudioContext. */
    start() {
        if (this.started) return;
        this.started = true;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 2000;
        this.filterNode.Q.value = 1;

        this.filterNode.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // Warm pad — two detuned oscillators
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 130.81; // C3
            osc.detune.value = i * 8 - 4;

            const gain = this.ctx.createGain();
            gain.gain.value = 0.12;

            osc.connect(gain);
            gain.connect(this.filterNode);
            osc.start();

            this.padOscs.push(osc);
            this.padGains.push(gain);
        }

        this.nextNoteTime = this.ctx.currentTime + 0.5;
    }

    /**
     * @param corruption 0–1 corruption intensity
     */
    update(corruption: number) {
        if (!this.ctx || !this.filterNode || !this.masterGain) return;
        const now = this.ctx.currentTime;

        // Darken filter as corruption rises
        this.filterNode.frequency.setTargetAtTime(
            2000 - corruption * 1400,
            now,
            0.5,
        );

        // Shift pad pitch down slightly with corruption
        const basePitch = 130.81 - corruption * 30;
        for (const osc of this.padOscs) {
            osc.frequency.setTargetAtTime(basePitch, now, 0.3);
        }

        // Arpeggio — play gentle pluck notes on a timer
        if (now >= this.nextNoteTime) {
            this.playNote(corruption);
            // Speed up arp slightly with corruption
            const interval = 0.6 - corruption * 0.2;
            this.nextNoteTime = now + interval;
        }
    }

    stop() {
        if (!this.ctx) return;
        for (const osc of this.padOscs) {
            osc.stop();
        }
        this.padOscs = [];
        this.padGains = [];
        this.ctx.close();
        this.ctx = null;
        this.started = false;
    }

    private playNote(corruption: number) {
        if (!this.ctx || !this.filterNode) return;

        const freq = NOTES[this.arpIndex % NOTES.length];
        this.arpIndex++;

        // Slight random detune for organic feel, more with corruption
        const detune = (Math.random() - 0.5) * (5 + corruption * 40);

        const osc = this.ctx.createOscillator();
        osc.type = corruption > 0.5 ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const gain = this.ctx.createGain();
        const vol = 0.08 + corruption * 0.04;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(this.filterNode);
        osc.start();
        osc.stop(this.ctx.currentTime + 1);
    }
}
