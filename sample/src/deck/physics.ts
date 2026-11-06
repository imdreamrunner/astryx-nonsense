/**
 * The deck's card physics, as pure functions (velocities in px/ms and deg/ms, as PanResponder reports them):
 * - `releaseOutcome`: where the card is heading, judged from where it would be ~180 ms after release (position plus
 *   velocity), not from where the finger let go — a short fast flick counts, a long slow drag that stops does not.
 * - `flingPlan`: the card leaves along its release velocity (at least a minimum speed, so a slow accept still exits),
 *   falls under gravity on y and keeps spinning at its release angular rate, until it is off screen.
 * - `pivotSign` / `dragAngle`: a held card pivots about the finger; grabbed above its centre, a drag to the right turns
 *   it clockwise; grabbed below, counter-clockwise.
 * - `createVelocityTracker`: the release velocity over the last moves (the sample keeps its own small tracker: public
 *   samples use only the library's public API).
 */

/** How far ahead the release is projected. */
export const PROJECTION_MS = 180;
/** The projected travel (as a fraction of the screen width) that commits a swipe. */
export const COMMIT_FRACTION = 0.4;
/** Slowest exit speed (px/ms): a card released slowly past the line is still thrown off, not nudged. */
export const MIN_FLING_SPEED = 1.6;
/**
 * Gravity on a thrown card, px/ms² (≈ 7 200 pt/s²). Stronger than real gravity at screen scale on purpose: a throw
 * lasts only 200–650 ms, and the drop has to read as an arc in that time (about 150–250 pt over a typical exit).
 */
export const GRAVITY = 0.0072;
/** Degrees of turn per pixel of drag while held (scaled by the screen width below). */
export const HELD_TURN = 20;
/** Degrees per ms of spin per px/ms of horizontal release speed. */
export const SPIN_PER_SPEED = 0.22;
/** Bounds on the exit time (ms): never a jump, never a crawl. */
export const MIN_FLING_MS = 200;
export const MAX_FLING_MS = 650;

export type Outcome = 'accept' | 'skip' | 'return';

export function releaseOutcome(dx: number, vx: number, width: number): Outcome {
  const projected = dx + vx * PROJECTION_MS;
  if (projected > width * COMMIT_FRACTION) return 'accept';
  if (projected < -width * COMMIT_FRACTION) return 'skip';
  return 'return';
}

/** +1 when the card was taken above its centre, −1 below. */
export function pivotSign(grabY: number, cardHeight: number): 1 | -1 {
  return grabY <= cardHeight / 2 ? 1 : -1;
}

/** The held card's turn for a drag of `dx`. */
export function dragAngle(dx: number, width: number, pivot: 1 | -1): number {
  return pivot * (dx / Math.max(1, width)) * HELD_TURN;
}

export interface FlingStart {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  pivot: 1 | -1;
}

export interface FlingPlan {
  /** ms */
  duration: number;
  toX: number;
  toY: number;
  toAngle: number;
  /** Progress → fraction of the y travel: velocity plus gravity, y(t) = y0 + vy·t + ½·g·t². */
  yEasing: (p: number) => number;
}

/**
 * The throw: horizontal speed at least MIN_FLING_SPEED in the swipe's direction, a duration that carries the card's
 * near edge past the screen (half the screen width plus the card's diagonal from its rest), y under gravity, and spin
 * at the release rate (the drag's turn rate grows with speed and the pivot side).
 */
export function flingPlan(start: FlingStart, direction: 1 | -1, width: number, cardDiagonal: number): FlingPlan {
  const along = Math.sign(start.vx) === direction ? Math.abs(start.vx) : 0;
  const vx = direction * Math.max(MIN_FLING_SPEED, along);
  const exitX = direction * (width / 2 + cardDiagonal);
  const distance = Math.abs(exitX - start.x);
  const duration = Math.min(MAX_FLING_MS, Math.max(MIN_FLING_MS, distance / Math.abs(vx)));
  const toX = start.x + vx * duration;
  const travelY = start.vy * duration + 0.5 * GRAVITY * duration * duration;
  // A throw whose rise and fall cancel exactly would divide by zero below; a pixel of drop avoids it.
  const totalY = Math.abs(travelY) < 1 ? 1 : travelY;
  const yEasing = (p: number) => (start.vy * duration * p + 0.5 * GRAVITY * duration * duration * p * p) / totalY;
  const omega = start.pivot * vx * SPIN_PER_SPEED;
  return {duration, toX, toY: start.y + totalY, toAngle: start.angle + omega * duration, yEasing};
}

/** How far back (ms) the release velocity looks, and the shortest span it trusts. */
export const VELOCITY_WINDOW_MS = 100;
export const VELOCITY_MIN_SPAN_MS = 8;

export interface VelocityTracker {
  add(x: number, y: number, t: number): void;
  /** px/ms over the window; zero when the samples span too little time. */
  velocity(): {vx: number; vy: number};
  reset(): void;
}

export function createVelocityTracker(windowMs = VELOCITY_WINDOW_MS): VelocityTracker {
  let samples: {x: number; y: number; t: number}[] = [];
  return {
    add(x, y, t) {
      const last = samples[samples.length - 1];
      // A repeated timestamp updates the newest point instead of adding a zero-length step.
      if (last && t <= last.t) samples[samples.length - 1] = {x, y, t: last.t};
      else samples.push({x, y, t});
      const newest = samples[samples.length - 1]!.t;
      while (samples.length > 1 && samples[0]!.t < newest - windowMs) samples.shift();
    },
    velocity() {
      if (samples.length < 2) return {vx: 0, vy: 0};
      const newest = samples[samples.length - 1]!;
      const oldest = samples[0]!;
      const dt = newest.t - oldest.t;
      if (!(dt >= VELOCITY_MIN_SPAN_MS)) return {vx: 0, vy: 0};
      return {vx: (newest.x - oldest.x) / dt, vy: (newest.y - oldest.y) / dt};
    },
    reset() {
      samples = [];
    },
  };
}
