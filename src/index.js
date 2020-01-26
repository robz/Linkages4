/* @flow */

import type {T as TDrawing, TWindow} from './Drawing';
import type {T as TLinkage, Ref} from './Linkage';
import type {T as TPoint} from './Point';

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');

const {euclid} = require('./Point');

declare var window: TWindow;

type _UIState =
  | {|type: 'none'|}
  | {|type: 'p', ref: Ref|}
  | {|type: 'g', p: TPoint|}
  | {|type: 'pp', ref1: Ref, ref2: Ref|}
  | {|type: 'gg', p1: TPoint, p2: TPoint|}
  | {|type: 'pg' | 'gp', ref: Ref, p: TPoint|}
  | {|type: 'ppg' | 'pgp' | 'gpp', ref1: Ref, ref2: Ref, p: TPoint|}
  | {|type: 'pgg' | 'gpg' | 'ggp', ref: Ref, p1: TPoint, p2: TPoint|};
type UIState = $ReadOnly<_UIState>;

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

type TUserState = {
  linkage: TLinkage,
  mouseState: ?MouseState,
  uiState: UIState,
  traceState: {ref: ?Ref},
  optimizeState: ?OptimizeState,
};

function getLinesForUIState(
  uiState: UIState,
  mousePoint: TPoint,
  points: {+[Ref]: TPoint},
): ?Array<TPoint> {
  switch (uiState.type) {
    case 'p':
      return [points[uiState.ref], mousePoint];

    case 'g':
      return [uiState.p, mousePoint];

    case 'gp':
      return [uiState.p, mousePoint, points[uiState.ref]];

    case 'pg':
      return [points[uiState.ref], uiState.p, mousePoint];

    case 'pp':
      return [points[uiState.ref1], mousePoint, points[uiState.ref2]];

    case 'gg':
      return [uiState.p1, uiState.p2, mousePoint];

    default:
      return null;
  }
}

function reduceMouseUIState(
  uiState: UIState,
  mouseState: MouseState,
  mousePoint: TPoint,
): UIState {
  const ref = mouseState.pointRef;
  if (ref) {
    switch (uiState.type) {
      case 'none':
        return {type: 'p', ref};

      case 'p':
        return {type: 'pp', ref1: uiState.ref, ref2: ref};

      case 'g':
        return {type: 'gp', ref, p: uiState.p};

      case 'pg':
        return {type: 'pgp', ref1: uiState.ref, ref2: ref, p: uiState.p};

      case 'gg':
        return {type: 'ggp', ref, p1: uiState.p1, p2: uiState.p2};

      case 'gp':
        return {type: 'gpp', ref1: uiState.ref, ref2: ref, p: uiState.p};

      default:
        return {type: 'none'};
    }
  }

  switch (uiState.type) {
    case 'none':
      return {type: 'g', p: mousePoint};

    case 'g':
      return {type: 'gg', p1: uiState.p, p2: mousePoint};

    case 'p':
      return {type: 'pg', ref: uiState.ref, p: mousePoint};

    case 'pg':
      return {type: 'pgg', ref: uiState.ref, p1: uiState.p, p2: mousePoint};

    case 'gp':
      return {type: 'gpg', ref: uiState.ref, p1: uiState.p, p2: mousePoint};

    case 'pp':
      return {
        type: 'ppg',
        ref1: uiState.ref1,
        ref2: uiState.ref2,
        p: mousePoint,
      };

    default:
      return {type: 'none'};
  }
}

function reduceMouseUserState(
  uiState: UIState,
  theta: number,
  linkage: TLinkage,
): UIState {
  switch (uiState.type) {
    case 'ggp':
    case 'gpg': {
      const {p1, p2, ref} = uiState;
      Linkage.addJoint(linkage, theta, p1, p2, ref);
      return {type: 'none'};
    }

    case 'pgg': {
      const {p1, p2, ref} = uiState;
      Linkage.addJoint(linkage, theta, p2, p1, ref);
      return {type: 'none'};
    }

    case 'gpp':
    case 'pgp':
    case 'ppg': {
      const {p, ref1, ref2} = uiState;
      Linkage.addCoupler(linkage, theta, p, ref1, ref2);
      return {type: 'none'};
    }

    default:
      return uiState;
  }
}

const CLICK_THRESHOLD = 0.05;

function draw(
  drawing: TDrawing,
  time: number,
  mousePoint: ?TPoint,
  {linkage, uiState, traceState, optimizeState}: TUserState,
): void {
  Drawing.clearCanvas(drawing);
  Drawing.drawAxis(drawing);

  const theta = time * 0.005;
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

      const lines = getLinesForUIState(uiState, mousePoint, points);
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

function onMouseDown(
  time: number,
  mousePoint: TPoint,
  userState: TUserState,
): void {
  const theta = time * 0.005;
  const point = Linkage.getPoint(
    userState.linkage,
    theta,
    mousePoint,
    CLICK_THRESHOLD,
  );
  userState.mouseState = {
    pointRef: point?.ref,
    start: [...mousePoint],
    movedWhileDown: false,
  };
  if (userState.optimizeState?.type === 'waiting_to_draw') {
    userState.optimizeState = {
      type: 'drawing',
      path: [mousePoint],
      ref: userState.optimizeState.ref,
    };
  }
}

function onMouseMove(
  time: number,
  mousePoint: TPoint,
  userState: TUserState,
): void {
  const {linkage, mouseState, optimizeState} = userState;
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

  const theta = time * 0.005;
  Linkage.movePoint(linkage, theta, mouseRef, mousePoint);

  userState.mouseState = {...mouseState, movedWhileDown: true};
}

function onMouseUp(
  time: number,
  mousePoint: TPoint,
  userState: TUserState,
): void {
  const {mouseState, uiState, linkage, optimizeState} = userState;
  if (!mouseState) {
    return;
  }

  if (optimizeState?.type === 'drawing') {
    Linkage.optimize(linkage, optimizeState.ref, optimizeState.path);
    userState.optimizeState = {...optimizeState, type: 'optimizing'};
  } else if (!mouseState.movedWhileDown) {
    const theta = time * 0.005;
    let newUIState = reduceMouseUIState(uiState, mouseState, mousePoint);
    newUIState = reduceMouseUserState(newUIState, theta, linkage);
    if (newUIState.type.length === 3) {
      throw new Error(`uiState ${newUIState.type} not handled`);
    }

    userState.uiState = newUIState;
  }

  userState.mouseState = null;
}

function onKeyDown(time: number, key: string, userState: TUserState): void {
  switch (key) {
    case 'Escape':
      userState.uiState = {type: 'none'};
      Linkage.stopOptimizing(userState.linkage);
      break;

    case 't':
      if (userState.uiState.type === 'p') {
        if (userState.traceState.ref === userState.uiState.ref) {
          userState.traceState.ref = null;
        } else {
          userState.traceState.ref = userState.uiState.ref;
        }
        userState.uiState = {type: 'none'};
      }
      break;

    case 'o':
      if (userState.traceState.ref && userState.uiState.type === 'none') {
        userState.optimizeState = {
          type: 'waiting_to_draw',
          ref: userState.traceState.ref,
        };
      }
      break;

    case '+':
      Linkage.scaleAlpha(linkage, 1.01);
      break;

    case '-':
      Linkage.scaleAlpha(linkage, 0.99);
      break;
  }
}

const linkage = Linkage.make({
  grounds: {
    p1: [0, 0],
    p4: [0.3, 0],
  },
  rotaries: [
    {
      len: 0.2,
      p1: 'p1',
      p2: 'p2',
      phase: 0,
    },
  ],
  hinges: [
    {
      len1: 0.4,
      len2: 0.4,
      p1: 'p2',
      p2: 'p4',
      p3: 'p3',
    },
  ],
});

Drawing.start(
  Drawing.make('canvas0', window),
  draw,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onKeyDown,
  {
    linkage,
    mouseState: null,
    uiState: {type: 'none'},
    traceState: {ref: null},
    optimizeState: null,
  },
);
