/**
 * HarmoniX Music Player - Interactive Audio Visualizer (Canvas)
 * Modes: 'bars' (Spectrum Bars), 'circular' (Circular Pulse), 'wave' (Smooth Waveform)
 * Renders true FFT when local audio is playing, and rhythmic dynamic beat animations when online music is playing.
 */

import { Player } from './audio.js';
import { Storage } from './storage.js';

class AudioVisualizer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.mode = 'bars'; // 'bars' | 'circular' | 'wave'
    this.isRunning = false;
    this.tick = 0;

    const saved = Storage.getSettings();
    if (saved && saved.visualizerMode) {
      this.mode = saved.visualizerMode;
    }
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.start();
  }

  handleResize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
  }

  setMode(newMode) {
    if (['bars', 'circular', 'wave'].includes(newMode)) {
      this.mode = newMode;
      Storage.saveSettings({ visualizerMode: newMode });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    if (!this.isRunning) return;
    this.animationId = requestAnimationFrame(() => this.render());

    if (!this.ctx || !this.width || !this.height) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.tick += 0.04;

    const isPlaying = Player.isPlaying;
    const analyser = Player.getAnalyser();

    let dataArray = null;
    if (analyser && isPlaying && !Player.isCurrentTrackYouTube()) {
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
    } else if (isPlaying) {
      // Simulasikan beat & ritme musik dinamis yang responsif
      dataArray = this.generateSyntheticFft();
    }

    if (!isPlaying) {
      this.renderIdle();
    } else {
      if (this.mode === 'bars') {
        this.renderBars(dataArray);
      } else if (this.mode === 'circular') {
        this.renderCircular(dataArray);
      } else if (this.mode === 'wave') {
        this.renderWave(dataArray);
      }
    }
  }

  // Menghasilkan data spektrum dinamis mengikuti ketukan musik
  generateSyntheticFft() {
    const bars = 64;
    const arr = new Uint8Array(bars);
    const t = this.tick;

    for (let i = 0; i < bars; i++) {
      // Bass boost di frekuensi rendah (i < 12)
      const bassFactor = i < 12 ? Math.abs(Math.sin(t * 3.5)) * 140 : 50;
      const midFactor = Math.abs(Math.cos(i * 0.4 + t * 2)) * 80;
      const noise = (Math.sin(i * 1.5 + t * 4) + 1) * 30;
      arr[i] = Math.min(255, Math.floor(bassFactor + midFactor + noise + 20));
    }
    return arr;
  }

  renderIdle() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h / 2);

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.2)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;

    for (let x = 0; x < w; x += 6) {
      const y = h / 2 + Math.sin(x * 0.02 + this.tick * 0.5) * 8 + Math.cos(x * 0.01 - this.tick * 0.3) * 4;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  renderBars(dataArray) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const barCount = Math.min(48, Math.floor(w / 7));
    const barWidth = Math.max(3, (w / barCount) - 3);
    const step = Math.floor(dataArray.length / barCount);

    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#a855f7');
    gradient.addColorStop(1, '#06b6d4');

    ctx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
      const val = dataArray[i * step] || 0;
      const percent = val / 255;
      const barHeight = Math.max(4, percent * (h * 0.85));
      const x = i * (barWidth + 3) + 2;
      const y = h - barHeight;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
      ctx.fill();
    }
  }

  renderCircular(dataArray) {
    const ctx = this.ctx;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(centerX, centerY) * 0.45;
    const bars = 56;
    const step = Math.floor(dataArray.length / bars);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.tick * 0.3);

    // Lingkaran dalam
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2;
      const val = dataArray[i * step] || 0;
      const barLength = Math.max(6, (val / 255) * (radius * 0.85));

      const xStart = Math.cos(angle) * radius;
      const yStart = Math.sin(angle) * radius;
      const xEnd = Math.cos(angle) * (radius + barLength);
      const yEnd = Math.sin(angle) * (radius + barLength);

      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xEnd, yEnd);
      ctx.strokeStyle = `hsl(${(i / bars) * 260 + 180}, 85%, 65%)`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  renderWave(dataArray) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const sliceWidth = w / dataArray.length;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h / 2);

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#06b6d4');
    gradient.addColorStop(0.5, '#a855f7');
    gradient.addColorStop(1, '#ec4899');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';

    let x = 0;
    for (let i = 0; i < dataArray.length; i += 2) {
      const v = dataArray[i] / 128.0;
      const y = (v * (h * 0.4)) + (h * 0.1);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth * 2;
    }

    ctx.stroke();
    ctx.restore();
  }
}

export const Visualizer = new AudioVisualizer();
