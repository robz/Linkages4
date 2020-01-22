/* @flow */

import type {Point, TWindow, t as TDrawing} from './Drawing';
import type {t as TLinkage, ref} from './Linkage';

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');

const euclid = require('./euclid');

declare var window: TWindow;

type UIState =
  | {|type: 'none'|}
  | {|
      type: 'p',
      ref: ref,
    |}
  | {|
      type: 'g',
      p: Point,
    |}
  | {|
      type: 'pp',
      ref1: ref,
      ref2: ref,
    |}
  | {|
      type: 'pg',
      ref: ref,
      p: Point,
    |}
  | {|
      type: 'gp',
      ref: ref,
      p: Point,
    |}
  | {|
      type: 'gg',
      p1: Point,
      p2: Point,
    |}
  | {|
      type: 'ppg',
      ref1: ref,
      ref2: ref,
      p: Point,
    |}
  | {|
      type: 'pgp',
      ref1: ref,
      ref2: ref,
      p: Point,
    |}
  | {|
      type: 'gpp',
      ref1: ref,
      ref2: ref,
      p: Point,
    |}
  | {|
      type: 'pgg',
      ref: ref,
      p1: Point,
      p2: Point,
    |}
  | {|
      type: 'gpg',
      ref: ref,
      p1: Point,
      p2: Point,
    |}
  | {|
      type: 'ggp',
      ref: ref,
      p1: Point,
      p2: Point,
    |};

type MouseState = {|
  pointRef: ?ref,
  start: Point,
  movedWhileDown: boolean,
|};

type TUserState = {
  linkage: TLinkage,
  mouseState: ?MouseState,
  uiState: UIState,
};

function getLinesForUIState(
  uiState: UIState,
  mousePoint: Point,
  points: {[ref]: Point},
): ?Array<Point> {
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
  mousePoint: Point,
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

function reduceMouseUserState(uiState, theta, linkage) {
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
  mousePoint: ?Point,
  {linkage, uiState}: TUserState,
) {
  Drawing.clearCanvas(drawing);
  Drawing.drawAxis(drawing);

  const theta = time * 0.005;
  const data = Linkage.calc(linkage, theta);
  if (data) {
    const {points, lines} = data;
    for (const line of lines) {
      Drawing.drawLines(drawing, line);
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

  if (mousePoint) {
    Drawing.drawCircle(drawing, mousePoint[0], mousePoint[1], CLICK_THRESHOLD);
  }
}

function onMouseDown(
  t: TDrawing,
  time: number,
  mousePoint: Point,
  userState: TUserState,
) {
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
}

function onMouseMove(
  t: TDrawing,
  time: number,
  mousePoint: Point,
  {linkage, mouseState}: TUserState,
) {
  if (!mouseState || !mouseState.pointRef) {
    return;
  }
  const mouseRef = mouseState.pointRef;

  if (euclid(mouseState.start, mousePoint) < 1e-2) {
    return;
  }

  mouseState.movedWhileDown = true;

  const theta = time * 0.005;
  Linkage.movePoint(linkage, theta, mouseRef, mousePoint);
}

function onMouseUp(
  t: TDrawing,
  time: number,
  mousePoint: Point,
  userState: TUserState,
) {
  const {mouseState, uiState, linkage} = userState;
  if (!mouseState) {
    return;
  }

  if (!mouseState.movedWhileDown) {
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

function onKeyDown(
  t: TDrawing,
  time: number,
  key: string,
  userState: TUserState,
) {
  switch (key) {
    case 'Escape':
      userState.uiState = {type: 'none'};
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
  },
);
