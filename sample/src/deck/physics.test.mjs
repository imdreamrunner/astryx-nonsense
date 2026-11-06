// Unit tests for the deck physics (pure functions). Run: npm test (node --test; Node strips the TypeScript types).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMMIT_FRACTION, createVelocityTracker, dragAngle, flingPlan, GRAVITY, MAX_FLING_MS, MIN_FLING_MS, MIN_FLING_SPEED, pivotSign, PROJECTION_MS, releaseOutcome} from './physics.ts';

const W = 402;
const DIAG = 200;

test('releaseOutcome projects the release: a short fast flick commits, a long drag that stopped returns', () => {
  const line = W * COMMIT_FRACTION;
  assert.equal(releaseOutcome(40, 1.2, W), 'accept'); // 40 + 216 > 160.8
  assert.equal(releaseOutcome(-40, -1.2, W), 'skip');
  assert.equal(releaseOutcome(line + 10, 0, W), 'accept');
  assert.equal(releaseOutcome(line + 10, -(line + 10) / PROJECTION_MS - 0.1, W), 'return'); // dragged past, thrown back
  assert.equal(releaseOutcome(100, 0, W), 'return');
});

test('pivotSign and dragAngle: above the centre turns clockwise to the right, below counter-clockwise', () => {
  assert.equal(pivotSign(10, 400), 1);
  assert.equal(pivotSign(390, 400), -1);
  assert.ok(dragAngle(100, W, 1) > 0);
  assert.ok(dragAngle(100, W, -1) < 0);
  assert.equal(dragAngle(0, W, 1), 0);
});

test('flingPlan: always leaves the screen in the swipe direction, within the time bounds', () => {
  for (const vx of [0, 0.3, 1.6, 3, 8, -0.5]) {
    for (const direction of [1, -1]) {
      const plan = flingPlan({x: 30 * direction, y: 0, angle: 0, vx, vy: 0, pivot: 1}, direction, W, DIAG);
      assert.ok(plan.duration >= MIN_FLING_MS && plan.duration <= MAX_FLING_MS, `duration ${plan.duration}`);
      assert.ok(direction * plan.toX >= W / 2 + DIAG, `toX ${plan.toX} for vx ${vx}, direction ${direction}`);
    }
  }
});

test('flingPlan: a release against the swipe still exits at the minimum speed', () => {
  const plan = flingPlan({x: 200, y: 0, angle: 0, vx: -2, vy: 0, pivot: 1}, 1, W, DIAG);
  assert.ok(plan.toX > 200);
  assert.ok(Math.abs((plan.toX - 200) / plan.duration - MIN_FLING_SPEED) < 1e-9);
});

test('flingPlan: y follows y0 + vy·t + ½·g·t² through the easing, from 0 to 1', () => {
  const start = {x: 0, y: 10, angle: 0, vx: 2, vy: -0.6, pivot: 1};
  const plan = flingPlan(start, 1, W, DIAG);
  assert.ok(Math.abs(plan.yEasing(0)) < 1e-12);
  assert.ok(Math.abs(plan.yEasing(1) - 1) < 1e-9);
  const t = plan.duration / 2;
  const expected = start.vy * t + 0.5 * GRAVITY * t * t;
  assert.ok(Math.abs(start.y + (plan.toY - start.y) * plan.yEasing(0.5) - (start.y + expected)) < 1e-6);
  // Thrown upward it rises (above where it started early on); thrown level, gravity alone carries it down.
  assert.ok((plan.toY - start.y) * plan.yEasing(0.05) < 0);
  const level = flingPlan({...start, vy: 0}, 1, W, DIAG);
  assert.ok(level.toY > start.y);
});

test('flingPlan: spin carries the pivot side and grows with speed', () => {
  const slow = flingPlan({x: 0, y: 0, angle: 0, vx: 1.6, vy: 0, pivot: 1}, 1, W, DIAG);
  const below = flingPlan({x: 0, y: 0, angle: 0, vx: 1.6, vy: 0, pivot: -1}, 1, W, DIAG);
  const fast = flingPlan({x: 0, y: 0, angle: 0, vx: 6, vy: 0, pivot: 1}, 1, W, DIAG);
  assert.ok(slow.toAngle > 0 && below.toAngle < 0);
  assert.ok(fast.toAngle / fast.duration > slow.toAngle / slow.duration);
});

test('createVelocityTracker: px/ms over the last 100 ms; a repeated end point does not zero a fast flick', () => {
  const tracker = createVelocityTracker();
  tracker.add(0, 0, 0);
  tracker.add(20, 0, 10);
  tracker.add(60, 10, 30);
  tracker.add(60, 10, 30); // the end point repeated
  const {vx, vy} = tracker.velocity();
  assert.equal(vx, 2);
  assert.ok(Math.abs(vy - 1 / 3) < 1e-9);
  tracker.reset();
  assert.deepEqual(tracker.velocity(), {vx: 0, vy: 0});
  tracker.add(0, 0, 0);
  tracker.add(500, 0, 300);
  assert.deepEqual(tracker.velocity(), {vx: 0, vy: 0}); // the old sample fell out of the window: one point left
});

test('flingPlan: the arc is visible — a button-like throw (1.8 px/ms, slight lift) ends well below where it started', () => {
  const plan = flingPlan({x: 0, y: 0, angle: 0, vx: 1.8, vy: -0.15, pivot: 1}, 1, W, DIAG);
  assert.ok(plan.toY > 120, `drop ${plan.toY}`);
  const flick = flingPlan({x: 40, y: 0, angle: 0, vx: 2.5, vy: 0, pivot: 1}, 1, W, DIAG);
  assert.ok(flick.toY > 100, `drop ${flick.toY}`);
});
