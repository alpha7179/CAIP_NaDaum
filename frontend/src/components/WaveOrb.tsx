// 나다움 시그니처: 회전 파티클 구체 (CSS --accent 컬러)
import { useEffect, useRef } from 'react';

export interface WaveOrbProps {
  readonly size?: number;
  readonly active?: boolean;
  readonly intensity?: number;
}

interface OrbState {
  active: boolean;
  intensity: number;
}

export function WaveOrb({ size = 240, active = false, intensity = 1 }: WaveOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>({ active, intensity });
  stateRef.current = { active, intensity };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    function readColor(): { accent: string; dark: boolean } {
      const cs = getComputedStyle(document.documentElement);
      const accent = cs.getPropertyValue('--accent').trim() || '#1faa6a';
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      return { accent, dark };
    }
    function hexToRgb(h: string): [number, number, number] {
      let s = h.replace('#', '');
      if (s.length === 3) s = s.split('').map((c) => c + c).join('');
      const n = parseInt(s, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    const N = size < 80 ? 340 : 760;
    const pts: Array<{ x: number; y: number; z: number; seed: number }> = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i += 1) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, seed: Math.random() });
    }

    const mouse = { x: 0, y: 0, inside: false };
    const offX = new Float32Array(N);
    const offY = new Float32Array(N);
    function onPointerMove(e: PointerEvent): void {
      if (canvas === null) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const margin = canvas.width * 0.25;
      mouse.inside =
        mouse.x > -margin &&
        mouse.x < canvas.width + margin &&
        mouse.y > -margin &&
        mouse.y < canvas.height + margin;
    }
    function onPointerOut(): void {
      mouse.inside = false;
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('blur', onPointerOut);

    let raf = 0;
    let t = 0;
    function draw(): void {
      if (ctx === null || canvas === null) return;
      t += 0.012;
      const { active: act, intensity: inten } = stateRef.current;
      const { accent, dark } = readColor();
      const A = hexToRgb(accent);
      const B: [number, number, number] = [
        Math.min(255, A[0] + 120),
        Math.min(255, A[1] + 120),
        Math.min(255, A[2] + 120),
      ];
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const R = ((size * dpr) / 2) * 0.82;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

      const rotY = t * 0.32;
      const rotX = Math.sin(t * 0.18) * 0.32;
      const energy = act ? 0.6 + inten * 0.5 : 0.18;
      const breathe = 1 + Math.sin(t * 1.1) * (act ? 0.045 : 0.022);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const drawn: Array<{ x: number; y: number; z: number; seed: number; idx: number }> = [];
      let idx = 0;
      for (const p of pts) {
        const wave =
          Math.sin(p.y * 5 + t * 2.4 + p.seed * 6.28) * 0.5 + Math.sin(p.x * 4 - t * 1.7) * 0.5;
        const rad = (1 + wave * 0.06 * (act ? 1.6 : 1)) * breathe;
        const x = p.x * rad;
        const y = p.y * rad;
        const z = p.z * rad;
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        drawn.push({ x: x1, y: y2, z: z2, seed: p.seed, idx });
        idx += 1;
      }
      drawn.sort((a, b) => a.z - b.z);

      const reach = R * 0.55;
      for (const p of drawn) {
        const persp = 0.62 + (p.z + 1) * 0.19;
        let sx = cx + p.x * R;
        let sy = cy + p.y * R;

        let tx = 0;
        let ty = 0;
        if (mouse.inside) {
          const dx = sx - mouse.x;
          const dy = sy - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < reach && d > 0.001) {
            const f = (1 - d / reach) ** 2 * reach * 0.5 * persp;
            tx = (dx / d) * f;
            ty = (dy / d) * f;
          }
        }
        const ox = (offX[p.idx] ?? 0) + (tx - (offX[p.idx] ?? 0)) * 0.16;
        const oy = (offY[p.idx] ?? 0) + (ty - (offY[p.idx] ?? 0)) * 0.16;
        offX[p.idx] = ox;
        offY[p.idx] = oy;
        sx += ox;
        sy += oy;
        const depth = (p.z + 1) / 2;
        const pr = (0.7 + depth * 1.7) * dpr * persp;
        const mix = Math.min(1, depth * 0.7 + energy * 0.6 + Math.sin(t * 2 + p.seed * 6) * 0.12);
        const cr = Math.round(A[0] + (B[0] - A[0]) * mix);
        const cg = Math.round(A[1] + (B[1] - A[1]) * mix);
        const cb = Math.round(A[2] + (B[2] - A[2]) * mix);
        const alpha = (dark ? 0.26 : 0.42) + depth * 0.5;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.arc(sx, sy, pr, 0, 6.2832);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      const gr = R * (act ? 0.5 : 0.34);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      g.addColorStop(0, `rgba(${A[0]},${A[1]},${A[2]},${dark ? 0.5 : 0.26})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, gr, 0, 6.2832);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', onPointerOut);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="orb-particles"
      style={{ display: 'block', width: size, height: size }}
      aria-hidden="true"
    />
  );
}
