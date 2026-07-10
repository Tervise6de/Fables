// Draw helpers for the occult-synthwave look: additive layered strokes
// instead of shadowBlur (which is far too slow for hundreds of entities).

export const PALETTE = {
  bg: '#05040c',
  arena: '#0b0820',
  grid: 'rgba(120, 80, 220, 0.10)',
  boss: '#e239b7',        // magenta — the player
  bossDim: '#7c1f66',
  hero: '#37e2ff',        // cyan — the "enemies"
  heal: '#7dff9a',
  danger: '#ff5346',
  gold: '#ffc94d',
  white: '#f4efff',
};

// Additive glow disc: a few concentric fills at low alpha.
export function glowCircle(ctx, x, y, r, color, intensity = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.10 * intensity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + i * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = Math.min(1, 0.9 * intensity);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function ring(ctx, x, y, r, color, width = 2, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Regular polygon outline, used for hero bodies and boss plating.
export function poly(ctx, x, y, r, sides, rot, color, { fill = false, width = 2, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  if (fill) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  ctx.restore();
}

// Occult sigil ring: circle + inscribed rotating polygon + tick marks.
export function sigil(ctx, x, y, r, rot, color, alpha = 0.8) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  poly(ctx, x, y, r * 0.82, 3, rot, color, { alpha });
  poly(ctx, x, y, r * 0.82, 3, -rot + Math.PI / 3, color, { alpha: alpha * 0.7 });
  for (let i = 0; i < 12; i++) {
    const a = rot * 0.3 + (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
    ctx.stroke();
  }
  ctx.restore();
}

export function text(ctx, str, x, y, { size = 16, color = PALETTE.white, align = 'center', alpha = 1, font = "'Courier New', monospace", bold = true, glow = null } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.6; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Health bar with border, used above heroes.
export function bar(ctx, x, y, w, h, frac, color, backAlpha = 0.55) {
  ctx.save();
  ctx.globalAlpha = backAlpha;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2 + 1, y + 1, Math.max(0, (w - 2) * frac), h - 2);
  ctx.restore();
}
