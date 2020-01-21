/* @flow */

import type {Point} from './euclid';

export type ref = string;

type Spec = {|
  grounds: {[ref]: Point},
  rotaries: Array<{len: number, p1: ref, p2: ref, phase: number}>,
  hinges: Array<{len1: number, len2: number, p1: ref, p2: ref, p3: ref}>,
|};
export type t = {|refCount: number, ...Spec|};

const euclid = require('./euclid');

function calcHinge(
  [x1, y1]: Point,
  [x2, y2]: Point,
  l1: number,
  l2: number,
): ?Point {
  const l3 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (l3 > l1 + l2 || l1 > l3 + l2 || l2 > l3 + l1) {
    return null;
  }
  const theta1 = Math.atan2(y2 - y1, x2 - x1);
  const theta2 = Math.acos((l2 ** 2 - l1 ** 2 - l3 ** 2) / (-2 * l1 * l3));
  if (isNaN(theta2)) {
    throw new Error('theta2 is NaN');
  }
  const theta3 = theta1 + theta2;
  const x3 = x1 + l1 * Math.cos(theta3);
  const y3 = y1 + l1 * Math.sin(theta3);

  return [x3, y3];
}

function calcRotary(
  theta: number,
  [x1, y1]: Point,
  len: number,
  phase: number,
): Point {
  const alpha = theta + phase;
  return [x1 + len * Math.cos(alpha), y1 + len * Math.sin(alpha)];
}

function calc(
  {grounds, rotaries, hinges}: t,
  theta: number,
): ?{points: {[ref]: Point}, lines: Array<Array<Point>>} {
  const points = {...grounds};
  const lines = [];

  for (const rotary of rotaries) {
    points[rotary.p2] = calcRotary(
      theta,
      points[rotary.p1],
      rotary.len,
      rotary.phase,
    );
    lines.push([points[rotary.p1], points[rotary.p2]]);
  }

  for (const hinge of hinges) {
    const p3 = calcHinge(
      points[hinge.p1],
      points[hinge.p2],
      hinge.len1,
      hinge.len2,
    );
    if (!p3) {
      return null;
    }
    points[hinge.p3] = p3;
    lines.push([points[hinge.p1], p3, points[hinge.p2]]);
  }

  return {points, lines};
}

function getPointRef(t: t, theta: number, p0: Point, threshold: number): ?ref {
  const data = calc(t, theta);
  if (!data) {
    return null;
  }
  const {points, lines} = data;

  for (const ref of Object.keys(points)) {
    if (euclid(points[ref], p0) < threshold) {
      return ref;
    }
  }

  return null;
}

function nullthrows<T>(x: ?T): T {
  if (x == null) {
    throw new Error('nullthrows');
  }
  return x;
}

function movePoint(t: t, theta: number, ref: ref, p: Point): void {
  if (t.grounds[ref]) {
    t.grounds[ref] = [...p];
    return;
  }

  for (const rotary of t.rotaries) {
    if (rotary.p2 === ref) {
      const [x1, y1] = t.grounds[rotary.p1];
      const x = p[0] - x1;
      const y = p[1] - y1;
      const len = Math.sqrt(x ** 2 + y ** 2);
      const thetaDesired = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
      rotary.phase = thetaDesired - theta;
      rotary.len = len;
      return;
    }
  }

  const hingePoints: Array<{|
    pointRef: string,
    lenRef: string,
    index: number,
  |}> = [];
  t.hinges.forEach((hinge, index) => {
    if (hinge.p1 === ref) {
      hingePoints.push({
        pointRef: hinge.p3,
        lenRef: 'len1',
        index,
      });
    } else if (hinge.p2 === ref) {
      hingePoints.push({
        pointRef: hinge.p3,
        lenRef: 'len2',
        index,
      });
    } else if (hinge.p3 === ref) {
      hingePoints.push({
        pointRef: hinge.p1,
        lenRef: 'len1',
        index,
      });
      hingePoints.push({
        pointRef: hinge.p2,
        lenRef: 'len2',
        index,
      });
    }
  });

  if (hingePoints.length === 0) {
    throw new Error(ref + ' is not a valid point');
  }

  const {points, lines} = nullthrows(calc(t, theta));
  for (const {pointRef, lenRef, index} of hingePoints) {
    t.hinges[index][lenRef] = euclid(p, points[pointRef]);
  }
}

function addJoint(t: t, theta: number, p1: Point, p3: Point, ref: ref): void {
  const p1Ref = `p${t.refCount + 1}`;
  const p3Ref = `p${t.refCount + 2}`;

  const {points, lines} = nullthrows(calc(t, theta));

  const len1 = euclid(points[ref], p3);
  const len2 = euclid(p1, p3);
  const p3next = calcHinge(points[ref], p1, len1, len2);
  if (!p3next) {
    return;
  }

  if (euclid(p3next, p3) < 1e-6) {
    t.hinges.push({
      len1,
      len2,
      p1: ref,
      p2: p1Ref,
      p3: p3Ref,
    });
  } else {
    t.hinges.push({
      len1: len2,
      len2: len1,
      p1: p1Ref,
      p2: ref,
      p3: p3Ref,
    });
  }

  t.grounds[p1Ref] = p1;
  t.refCount += 2;
}

function addCoupler(
  t: t,
  theta: number,
  p3: Point,
  ref1: ref,
  ref2: ref,
): void {
  const p3Ref = `p${t.refCount + 1}`;

  const {points, lines} = nullthrows(calc(t, theta));
  const len1 = euclid(points[ref1], p3);
  const len2 = euclid(points[ref2], p3);
  const p3next = calcHinge(points[ref1], points[ref2], len1, len2);
  if (!p3next) {
    return;
  }

  if (euclid(p3next, p3) < 1e-6) {
    t.hinges.push({
      len1,
      len2,
      p1: ref1,
      p2: ref2,
      p3: p3Ref,
    });
  } else {
    t.hinges.push({
      len1: len2,
      len2: len1,
      p1: ref2,
      p2: ref1,
      p3: p3Ref,
    });
  }

  t.refCount += 1;
}

function parseRef(ref: string): {kind: string, num: number} {
  const match = ref.match(/([p])([0-9]+)/);
  if (!match) {
    throw new Error('invalid ref ' + ref);
  }
  return {kind: match[1], num: Number(match[2])};
}

function make(spec: Spec): t {
  let refCount = 0;

  for (const ref of Object.keys(spec.grounds)) {
    refCount = Math.max(refCount, parseRef(ref).num);
  }

  for (const rotary of spec.rotaries) {
    refCount = Math.max(
      refCount,
      parseRef(rotary.p1).num,
      parseRef(rotary.p2).num,
    );
  }

  for (const hinge of spec.hinges) {
    refCount = Math.max(
      refCount,
      parseRef(hinge.p1).num,
      parseRef(hinge.p2).num,
      parseRef(hinge.p3).num,
    );
  }

  return {...spec, refCount};
}

module.exports = {
  calc,
  make,
  getPointRef,
  movePoint,
  addJoint,
  addCoupler,
};
