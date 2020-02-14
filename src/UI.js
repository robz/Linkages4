/* @flow */

import type {T as TDrawing} from './Drawing';
import type {T as TLinkage, Ref} from './Linkage';
import type {T as TPoint} from './Point';

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');

const {euclid} = require('./Point');

type Mode = 'rotary' | 'slider' | 'hinge';
type _ClickState =
  | {|type: 'none'|}
  | {|type: 'p', ref: Ref|}
  | {|type: 'g', p: TPoint|}
  | {|type: 'pp', ref1: Ref, ref2: Ref|}
  | {|type: 'gg', p1: TPoint, p2: TPoint|}
  | {|type: 'pg' | 'gp', ref: Ref, p: TPoint|}
  | {|type: 'ppg' | 'pgp' | 'gpp', ref1: Ref, ref2: Ref, p: TPoint|}
  | {|type: 'pgg' | 'gpg' | 'ggp', ref: Ref, p1: TPoint, p2: TPoint|};
type ClickState = $ReadOnly<{..._ClickState, mode: Mode}>;

type MouseState = $ReadOnly<{|
  pointRef: ?Ref,
  start: TPoint,
  movedWhileDown: boolean,
|}>;

type _OptimizeState =
  | {|
      type: 'waiting_to_draw',
      ref: Ref,
    |}
  | {|
      type: 'drawing' | 'optimizing',
      ref: Ref,
      path: Array<TPoint>,
    |};
type OptimizeState = $ReadOnly<_OptimizeState>;

export opaque type T = {|
  linkage: TLinkage,
  mouseState: ?MouseState,
  clickState: ClickState,
  traceState: {ref: ?Ref},
  optimizeState: ?OptimizeState,
|};

function getLinesForClickState(
  clickState: ClickState,
  mousePoint: TPoint,
  points: {+[Ref]: TPoint},
): ?Array<TPoint> {
  switch (clickState.type) {
    case 'p':
      return [points[clickState.ref], mousePoint];

    case 'g':
      return [clickState.p, mousePoint];

    case 'gp':
      return [clickState.p, mousePoint, points[clickState.ref]];

    case 'pg':
      return [points[clickState.ref], clickState.p, mousePoint];

    case 'pp':
      return [points[clickState.ref1], mousePoint, points[clickState.ref2]];

    case 'gg':
      return [clickState.p1, clickState.p2, mousePoint];

    default:
      return null;
  }
}

function reduceMouseClickState(
  clickState: ClickState,
  mouseState: MouseState,
  mousePoint: TPoint,
): ClickState {
  const mode = clickState.mode;
  const ref = mouseState.pointRef;
  if (ref) {
    switch (clickState.type) {
      case 'none':
        return {type: 'p', ref, mode};

      case 'p':
        return {type: 'pp', ref1: clickState.ref, ref2: ref, mode};

      case 'g':
        return {type: 'gp', ref, p: clickState.p, mode};

      case 'pg':
        return {
          type: 'pgp',
          ref1: clickState.ref,
          ref2: ref,
          p: clickState.p,
          mode,
        };

      case 'gg':
        return {type: 'ggp', ref, p1: clickState.p1, p2: clickState.p2, mode};

      case 'gp':
        return {
          type: 'gpp',
          ref1: clickState.ref,
          ref2: ref,
          p: clickState.p,
          mode,
        };

      default:
        return {type: 'none', mode};
    }
  }

  switch (clickState.type) {
    case 'none':
      return {type: 'g', p: mousePoint, mode};

    case 'g':
      return {type: 'gg', p1: clickState.p, p2: mousePoint, mode};

    case 'p':
      return {type: 'pg', ref: clickState.ref, p: mousePoint, mode};

    case 'pg':
      return {
        type: 'pgg',
        ref: clickState.ref,
        p1: clickState.p,
        p2: mousePoint,
        mode,
      };

    case 'gp':
      return {
        type: 'gpg',
        ref: clickState.ref,
        p1: clickState.p,
        p2: mousePoint,
        mode,
      };

    case 'pp':
      return {
        type: 'ppg',
        ref1: clickState.ref1,
        ref2: clickState.ref2,
        p: mousePoint,
        mode,
      };

    default:
      return {type: 'none', mode};
  }
}

function reduceMouseUserState(
  clickState: ClickState,
  theta: number,
  linkage: TLinkage,
): ClickState {
  const mode = clickState.mode;
  switch (clickState.type) {
    case 'ggp':
    case 'gpg': {
      const {p1, p2, ref} = clickState;
      Linkage.addJoint(linkage, theta, p1, p2, ref);
      return {type: 'none', mode};
    }

    case 'pgg': {
      const {p1, p2, ref} = clickState;
      switch (mode) {
        case 'rotary':
          throw new Error('wat');
        case 'hinge':
          Linkage.addJoint(linkage, theta, p2, p1, ref);
        case 'slider':
          Linkage.addSlider(linkage, theta, ref, p1, p2);
      }
      return {type: 'none', mode};
    }

    case 'gpp':
    case 'pgp':
    case 'ppg': {
      const {p, ref1, ref2} = clickState;
      Linkage.addCoupler(linkage, theta, p, ref1, ref2);
      return {type: 'none', mode};
    }

    default:
      return clickState;
  }
}

const CLICK_THRESHOLD = 0.05;
const SPEED = 0.001;

function draw(
  drawing: TDrawing,
  time: number,
  mousePoint: ?TPoint,
  {linkage, clickState, traceState, optimizeState}: T,
): void {
  Drawing.clearCanvas(drawing);
  Drawing.drawAxis(drawing);

  const theta = time * SPEED;
  const data = Linkage.calc(linkage, theta);
  if (data) {
    const {points, lines} = data;
    for (const line of lines) {
      Drawing.drawLines(drawing, line);
    }

    if (traceState.ref) {
      const points = Linkage.calcPath(linkage, traceState.ref, 100);
      Drawing.drawLines(drawing, points);
    }

    if (mousePoint) {
      const point = Linkage.getPoint(
        linkage,
        theta,
        mousePoint,
        CLICK_THRESHOLD,
      );
      if (point) {
        Drawing.drawCircle(drawing, point.point[0], point.point[1], 0.01);
      }

      const lines = getLinesForClickState(clickState, mousePoint, points);
      if (lines) {
        Drawing.drawLines(drawing, lines);
      }
    }
  }

  if (
    (optimizeState?.type === 'drawing' ||
      optimizeState?.type === 'optimizing') &&
    optimizeState.path.length
  ) {
    Drawing.drawLines(drawing, optimizeState.path);
  }

  if (mousePoint) {
    Drawing.drawCircle(drawing, mousePoint[0], mousePoint[1], CLICK_THRESHOLD);
  }
}

function onMouseDown(time: number, mousePoint: TPoint, appState: T): void {
  const theta = time * SPEED;
  const point = Linkage.getPoint(
    appState.linkage,
    theta,
    mousePoint,
    CLICK_THRESHOLD,
  );
  appState.mouseState = {
    pointRef: point?.ref,
    start: [...mousePoint],
    movedWhileDown: false,
  };
  if (appState.optimizeState?.type === 'waiting_to_draw') {
    appState.optimizeState = {
      type: 'drawing',
      path: [mousePoint],
      ref: appState.optimizeState.ref,
    };
  }
}

function onMouseMove(time: number, mousePoint: TPoint, appState: T): void {
  const {linkage, mouseState, optimizeState} = appState;
  if (!mouseState || !mouseState.pointRef) {
    if (optimizeState?.type === 'drawing') {
      optimizeState.path.push(mousePoint);
    }
    return;
  }
  const mouseRef = mouseState.pointRef;

  if (euclid(mouseState.start, mousePoint) < 1e-2) {
    return;
  }

  const theta = time * SPEED;
  Linkage.movePoint(linkage, theta, mouseRef, mousePoint);

  appState.mouseState = {...mouseState, movedWhileDown: true};
}

function onMouseUp(time: number, mousePoint: TPoint, appState: T): void {
  const {mouseState, clickState, linkage, optimizeState} = appState;
  if (!mouseState) {
    return;
  }

  if (optimizeState?.type === 'drawing') {
    Linkage.optimize(linkage, optimizeState.ref, optimizeState.path);
    appState.optimizeState = {...optimizeState, type: 'optimizing'};
  } else if (!mouseState.movedWhileDown) {
    const theta = time * SPEED;
    let newClickState = reduceMouseClickState(
      clickState,
      mouseState,
      mousePoint,
    );
    newClickState = reduceMouseUserState(newClickState, theta, linkage);
    if (newClickState.type.length === 3) {
      throw new Error(`clickState ${newClickState.type} not handled`);
    }

    appState.clickState = newClickState;
  }

  appState.mouseState = null;
}

function onKeyDown(time: number, key: string, appState: T): void {
  switch (key) {
    case 'Escape':
      appState.clickState = {type: 'none', mode: 'slider'};
      Linkage.stopOptimizing(appState.linkage);
      break;

    case 't':
      if (appState.clickState.type === 'p') {
        if (appState.traceState.ref === appState.clickState.ref) {
          appState.traceState.ref = null;
        } else {
          appState.traceState.ref = appState.clickState.ref;
        }
        appState.clickState = {type: 'none', mode: 'slider'};
      }
      break;

    case 'o':
      if (appState.traceState.ref && appState.clickState.type === 'none') {
        appState.optimizeState = {
          type: 'waiting_to_draw',
          ref: appState.traceState.ref,
        };
      }
      break;

    case '+':
      Linkage.scaleOptimizeStepSize(appState.linkage, 1.01);
      break;

    case '-':
      Linkage.scaleOptimizeStepSize(appState.linkage, 0.99);
      break;
  }
}

function onChangeMode(t: T, mode: Mode) {
  t.clickState = {...t.clickState, mode};
}

function make(linkage: TLinkage): T {
  return {
    linkage,
    mouseState: null,
    clickState: {type: 'none', mode: 'slider'},
    traceState: {ref: null},
    optimizeState: null,
  };
}

module.exports = {
  make,
  draw,
  onMouseDown,
  onMouseUp,
  onMouseMove,
  onKeyDown,
  onChangeMode,
};
