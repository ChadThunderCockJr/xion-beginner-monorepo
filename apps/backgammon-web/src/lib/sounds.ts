let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function playDiceRoll() {
  try {
    const ac = getCtx();
    const duration = 0.35;
    const bufferSize = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 3500;
    filter.Q.value = 0.7;
    const gain = ac.createGain();
    gain.gain.value = 0.12;
    source.connect(filter).connect(gain).connect(ac.destination);
    source.start();
  } catch {}
}

export function playCheckerPlace() {
  try {
    const ac = getCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
    osc.type = "sine";
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {}
}

export function playCheckerHit() {
  try {
    const ac = getCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    osc.type = "triangle";
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    // Second click
    const osc2 = ac.createOscillator();
    osc2.frequency.setValueAtTime(600, t + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(200, t + 0.1);
    osc2.type = "sine";
    const gain2 = ac.createGain();
    gain2.gain.setValueAtTime(0.08, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc2.connect(gain2).connect(ac.destination);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.12);
  } catch {}
}

export function playTurnEnd() {
  try {
    const ac = getCtx();
    const t = ac.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.frequency.value = freq;
      osc.type = "sine";
      const gain = ac.createGain();
      const start = t + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {}
}

export function playGameOver(won: boolean) {
  try {
    const ac = getCtx();
    const t = ac.currentTime;
    const notes = won ? [523, 659, 784, 1047] : [400, 350, 300, 250];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.frequency.value = freq;
      osc.type = won ? "sine" : "triangle";
      const gain = ac.createGain();
      const start = t + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(won ? 0.08 : 0.05, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {}
}
