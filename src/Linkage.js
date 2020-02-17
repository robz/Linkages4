/* @flow */

import type {T as Point} from './Point';

const {euclid, euclidPath} = require('./Point');
const nullthrows = require('./nullthrows');

export opaque type Ref = string;

type Spec = $ReadOnly<{
  grounds: {[string]: Point},
  rotaries: Array<{|len: number, p1: string, p2: string, phase: number|}>,
  hinges: Array<{|
    len1: number,
    len2: number,
    p1: string,
    p2: string,
    p3: string,
  |}>,
  sliders: Array<{|
    p1: string,
    p2: string,
    p3: string,
    len: number,
  |}>,
}>;
export type T = {|
  refCount: number,
  optimizing: boolean,
  optimizeStepSize: number,
  onChange: T => mixed,

  /* Spec */
  grounds: {[Ref]: Point},
  rotaries: Array<{|len: number, p1: Ref, p2: Ref, phase: number|}>,
  hinges: Array<{|len1: number, len2: number, p1: Ref, p2: Ref, p3: Ref|}>,
  sliders: Array<{|p1: Ref, p2: Ref, p3: Ref, len: number|}>,
|};

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

function calcSlider(p1: Point, p2: Point, len: number): ?Point {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const alpha = Math.atan2(y2 - y1, x2 - x1);
  const p3 = [x1 + len * Math.cos(alpha), y1 + len * Math.sin(alpha)];
  if (euclid(p3, p1) < euclid(p2, p1)) {
    return null;
  }
  return p3;
}

function calc(
  {grounds, rotaries, hinges, sliders}: T,
  theta: number,
): ?{points: {[Ref]: Point}, lines: Array<Array<Point>>} {
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

  let progress = true;
  while (progress) {
    progress = false;

    for (const hinge of hinges) {
      if (!points[hinge.p1] || !points[hinge.p2]) {
        // dependencies not ready
        continue;
      }
      if (points[hinge.p3]) {
        // already calculated
        continue;
      }
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
      progress = true;
    }

    for (const slider of sliders) {
      if (!points[slider.p1] || !points[slider.p2]) {
        // dependencies not ready
        continue;
      }
      if (points[slider.p3]) {
        // already calculated
        continue;
      }
      const p3 = calcSlider(points[slider.p1], points[slider.p2], slider.len);
      if (!p3) {
        return null;
      }
      points[slider.p3] = p3;
      lines.push([points[slider.p1], p3]);
      progress = true;
    }
  }

  return {points, lines};
}

function getPoint(
  t: T,
  theta: number,
  p0: Point,
  threshold: number,
): ?{ref: Ref, point: Point} {
  const data = calc(t, theta);
  if (!data) {
    return null;
  }
  const {points, lines} = data;

  for (const ref of Object.keys(points)) {
    if (euclid(points[ref], p0) < threshold) {
      return {ref, point: points[ref]};
    }
  }

  return null;
}

function movePoint(t: T, theta: number, ref: Ref, p: Point): void {
  if (t.grounds[ref]) {
    t.grounds[ref] = [...p];
    t.onChange(t);
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
      t.onChange(t);
      return;
    }
  }

  const hingePoints: Array<{|
    pointRef: Ref,
    lenRef: Ref,
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

  const {points, lines} = nullthrows(calc(t, theta));
  if (hingePoints.length !== 0) {
    for (const {pointRef, lenRef, index} of hingePoints) {
      t.hinges[index][lenRef] = euclid(p, points[pointRef]);
    }
  }

  for (const slider of t.sliders) {
    if (slider.p3 === ref) {
      slider.len = euclid(p, points[slider.p1]);
    }
  }

  t.onChange(t);
}

function addRotary(t: T, theta: number, p1: Point, p2: Point): void {
  const p1Ref = `p${t.refCount + 1}`;
  const p2Ref = `p${t.refCount + 2}`;

  t.rotaries.push({
    len: euclid(p1, p2),
    p1: p1Ref,
    p2: p2Ref,
    phase: Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - theta,
  });

  t.grounds[p1Ref] = p1;
  t.refCount += 2;
  t.onChange(t);
}

function addJoint(t: T, theta: number, p1: Point, p3: Point, ref: Ref): void {
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
  t.onChange(t);
}

function addCoupler(
  t: T,
  theta: number,
  p3: Point,
  ref1: Ref,
  ref2: Ref,
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
  t.onChange(t);
}

function addSlider(
  t: T,
  theta: number,
  p1: Ref,
  p2: Point,
  p3: Point,
): boolean {
  const p2Ref = `p${t.refCount + 1}`;
  const p3Ref = `p${t.refCount + 2}`;

  const {points, lines} = nullthrows(calc(t, theta));

  const len = euclid(points[p1], p3);

  t.sliders.push({
    len,
    p1: p1,
    p2: p2Ref,
    p3: p3Ref,
  });
  t.grounds[p2Ref] = p2;
  t.refCount += 2;

  if (!calc(t, theta)) {
    t.sliders.pop();
    delete t.grounds[p2Ref];
    t.refCount -= 2;
    return false;
  }

  t.onChange(t);
  return true;
}

function calcPath(t: T, ref: Ref, n: number): Array<Point> {
  const path = [];
  for (let i = 0; i < n; i++) {
    const theta = (i * Math.PI * 2) / (n - 1);
    const data = calc(t, theta);
    if (data) {
      path.push(data.points[ref]);
    }
  }
  return path;
}

function optimize(t: T, ref: Ref, path: Array<Point>): void {
  t.optimizing = true;

  function tweak() {
    const prevPath = calcPath(t, ref, path.length);
    if (prevPath.length !== path.length) {
      setTimeout(tweak, 10);
      return;
    }
    const prevError = euclidPath(path, prevPath);
    const {optimizeStepSize} = t;
    const prevGrounds = {};
    for (const ref of Object.keys(t.grounds)) {
      prevGrounds[ref] = [...t.grounds[ref]];
      t.grounds[ref][0] += (Math.random() - 0.5) * optimizeStepSize;
      t.grounds[ref][1] += (Math.random() - 0.5) * optimizeStepSize;
    }

    const prevRotaries = [];
    for (const rotary of t.rotaries) {
      prevRotaries.push({...rotary, len: rotary.len, phase: rotary.phase});
      rotary.len += (Math.random() - 0.5) * optimizeStepSize;
      rotary.phase += (Math.random() - 0.5) * 10 * optimizeStepSize;
    }

    const prevHinges = [];
    for (const hinge of t.hinges) {
      prevHinges.push({...hinge, len1: hinge.len1, len2: hinge.len2});
      hinge.len1 += (Math.random() - 0.5) * optimizeStepSize;
      hinge.len2 += (Math.random() - 0.5) * optimizeStepSize;
    }

    const currentPath = calcPath(t, ref, path.length);
    if (currentPath.length !== path.length) {
      t.grounds = prevGrounds;
      t.rotaries = prevRotaries;
      t.hinges = prevHinges;
    } else {
      const error = euclidPath(path, currentPath);
      if (error > prevError) {
        t.grounds = prevGrounds;
        t.rotaries = prevRotaries;
        t.hinges = prevHinges;
      } else {
        t.onChange(t);
      }
    }

    if (t.optimizing) {
      setTimeout(tweak, 0);
    }
  }
  setTimeout(tweak, 0);
}

function stopOptimizing(t: T) {
  t.optimizing = false;
}

function parseRef(ref: Ref): {|kind: string, num: number|} {
  const match = ref.match(/([p])([0-9]+)/);
  if (!match) {
    throw new Error('invalid ref ' + ref);
  }
  return {kind: match[1], num: Number(match[2])};
}

function scaleOptimizeStepSize(t: T, scale: number): void {
  t.optimizeStepSize *= scale;
  console.log(t.optimizeStepSize);
}

function make(spec: $Exact<Spec>, onChange: T => mixed): T {
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

  for (const slider of spec.sliders) {
    refCount = Math.max(
      refCount,
      parseRef(slider.p1).num,
      parseRef(slider.p2).num,
      parseRef(slider.p3).num,
    );
  }

  return {
    ...spec,
    refCount,
    optimizing: false,
    optimizeStepSize: 0.03,
    onChange,
  };
}

type SpecCompressed = [
  /* ground xs */
  Array<number>,
  /* ground ys */
  Array<number>,
  /* rotaries */
  Array<[number, number, number, number]>,
  /* hinges */
  Array<[number, number, number, number, number]>,
  /* sliders */
  Array<[number, number, number, number]>,
];

function round(x) {
  const s = 1000;
  return Math.round(x * s) / s;
}

function compress({grounds, rotaries, hinges, sliders}: Spec): SpecCompressed {
  const groundXs = [];
  const groundYs = [];

  const m: Map<string, number> = new Map();
  const indexFromRef = (ref: string): number => {
    let index = m.get(ref);
    if (index == null) {
      index = m.size;
      m.set(ref, index);
    }
    return index;
  };

  Object.keys(grounds).forEach((pointRef: string, index) => {
    const [x, y] = grounds[pointRef];
    indexFromRef(pointRef);
    groundXs.push(round(x));
    groundYs.push(round(y));
  });

  return [
    groundXs,
    groundYs,
    rotaries.map(({p1, p2, len, phase}) => [
      indexFromRef(p1),
      indexFromRef(p2),
      round(len),
      round(phase),
    ]),
    hinges.map(({p1, p2, p3, len1, len2}) => [
      indexFromRef(p1),
      indexFromRef(p2),
      indexFromRef(p3),
      round(len1),
      round(len2),
    ]),
    sliders.map(({p1, p2, p3, len}) => [
      indexFromRef(p1),
      indexFromRef(p2),
      indexFromRef(p3),
      round(len),
    ]),
  ];
}

function refFromIndex(index: number): Ref {
  return 'p' + index;
}

function decompress([
  groundXs,
  groundYs,
  rotaries,
  hinges,
  sliders,
]: SpecCompressed): $Exact<Spec> {
  const grounds = {};

  groundXs.forEach((x, index) => {
    grounds[refFromIndex(index)] = [x, groundYs[index]];
  });

  return {
    grounds,
    rotaries: rotaries.map(([p1Index, p2Index, len, phase]) => ({
      p1: refFromIndex(p1Index),
      p2: refFromIndex(p2Index),
      len,
      phase,
    })),
    hinges: hinges.map(([p1Index, p2Index, p3Index, len1, len2]) => ({
      p1: refFromIndex(p1Index),
      p2: refFromIndex(p2Index),
      p3: refFromIndex(p3Index),
      len1,
      len2,
    })),
    sliders: sliders.map(([p1Index, p2Index, p3Index, len]) => ({
      p1: refFromIndex(p1Index),
      p2: refFromIndex(p2Index),
      p3: refFromIndex(p3Index),
      len,
    })),
  };
}

function serialize({grounds, hinges, rotaries, sliders}: T): string {
  return JSON.stringify(
    decompress(compress({grounds, hinges, rotaries, sliders})),
  );
}

module.exports = {
  calc,
  make,
  getPoint,
  movePoint,
  addRotary,
  addJoint,
  addCoupler,
  addSlider,
  calcPath,
  optimize,
  stopOptimizing,
  scaleOptimizeStepSize,
  serialize,
  decompress,
  compress,
};
