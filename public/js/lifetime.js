// One lifetime per match. Aborted work rejects before it can touch a later match.
export class Lifetime {
  controller = new AbortController();
  frames = new Set();
  timers = new Set();
  get signal() { return this.controller.signal; }
  check() { if (this.signal.aborted) throw new DOMException('Match ended', 'AbortError'); }
  listen(target, event, callback, options = {}) {
    target.addEventListener(event, callback, {...options, signal:this.signal});
  }
  frame(callback) {
    if (this.signal.aborted) return;
    const id = requestAnimationFrame(t => { this.frames.delete(id); if (!this.signal.aborted) callback(t); });
    this.frames.add(id);
  }
  wait(ms) {
    this.check();
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(id); this.timers.delete(id); reject(new DOMException('Match ended', 'AbortError')); };
      const id = setTimeout(() => { this.timers.delete(id); this.signal.removeEventListener('abort', abort); resolve(); }, ms);
      this.timers.add(id); this.signal.addEventListener('abort', abort, {once:true});
    });
  }
  tween(ms, update) {
    this.check();
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Match ended', 'AbortError'));
      this.signal.addEventListener('abort', abort, {once:true});
      const start = performance.now();
      const tick = now => {
        const t = Math.min(1, (now-start)/ms);
        update(t);
        if (t < 1) this.frame(tick);
        else { this.signal.removeEventListener('abort', abort); resolve(); }
      };
      this.frame(tick);
    });
  }
  dispose() {
    this.controller.abort();
    this.frames.forEach(cancelAnimationFrame); this.frames.clear();
    this.timers.forEach(clearTimeout); this.timers.clear();
  }
}
