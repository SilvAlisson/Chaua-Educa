// One owner for keyboard, pointer and accessible button activation.
export class FlightInput {
    constructor(game, onHeld = () => {}) {
        this.game = game;
        this.onHeld = onHeld;
        this.sources = new Set();
    }

    press(source) {
        if (!['playing', 'countdown'].includes(this.game.state) || this.sources.has(source)) return;
        const wasHeld = this.sources.size > 0;
        this.sources.add(source);
        if (!wasHeld) this.game.press();
        this.onHeld(true);
    }

    release(source) {
        if (!this.sources.delete(source)) return;
        if (!this.sources.size) { this.game.release(); this.onHeld(false); }
    }

    cancel(source) {
        // Normal pointerup may be followed by lostpointercapture; do not erase
        // a valid buffered tap that has already been released.
        if (!this.sources.delete(source)) return;
        if (!this.sources.size) { this.game.cancelInput(); this.onHeld(false); }
    }

    clear() {
        this.sources.clear();
        this.game.cancelInput();
        this.onHeld(false);
    }
}
