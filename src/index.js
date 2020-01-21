/* @flow */

import type {Point, TWindow, t as TDrawing} from './Drawing';
import type {t as TLinkage, ref} from './Linkage';

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');

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
  mouse: ?MouseState,
  uistate: UIState,
};

function draw(
  drawing: TDrawing,
  time: number,
  mouse: ?Point,
  {linkage, uistate}: TUserState,
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

    if (mouse) {
      switch (uistate.type) {
        case 'none':
          break;

        case 'p':
          Drawing.drawLines(drawing, [points[uistate.ref], mouse]);
          break;

        case 'g':
          Drawing.drawLines(drawing, [uistate.p, mouse]);
          break;

        case 'gp':
          Drawing.drawLines(drawing, [uistate.p, mouse, points[uistate.ref]]);
          break;

        case 'pg':
          Drawing.drawLines(drawing, [points[uistate.ref], uistate.p, mouse]);
          break;

        case 'pp':
          Drawing.drawLines(drawing, [
            points[uistate.ref1],
            mouse,
            points[uistate.ref2],
          ]);
          break;

        case 'gg':
          Drawing.drawLines(drawing, [uistate.p1, uistate.p2, mouse]);
          break;
      }
    }
  }

  if (mouse) {
    Drawing.drawCircle(drawing, mouse[0], mouse[1], 0.1);
  }
}

function onMouseDown(
  t: TDrawing,
  time: number,
  mouse: Point,
  state: TUserState,
) {
  const theta = time * 0.005;
  const pointRef = Linkage.getPointRef(state.linkage, theta, mouse, 0.1);
  state.mouse = {pointRef, start: [...mouse], movedWhileDown: false};
}

function onMouseMove(
  t: TDrawing,
  time: number,
  mouse: Point,
  state: TUserState,
) {
  if (!state.mouse || !state.mouse.pointRef) {
    return;
  }

  state.mouse.movedWhileDown = true;

  const theta = time * 0.005;
  Linkage.movePoint(state.linkage, theta, state.mouse.pointRef, mouse);
}

function getUIState(uistate: UIState, mouse: MouseState, mousePoint): UIState {
  const ref = mouse.pointRef;
  if (ref) {
    switch (uistate.type) {
      case 'none':
        return {
          type: 'p',
          ref,
        };

      case 'p':
        return {
          type: 'pp',
          ref1: uistate.ref,
          ref2: ref,
        };

      case 'g':
        return {
          type: 'gp',
          ref,
          p: uistate.p,
        };

      case 'pg':
        return {
          type: 'pgp',
          ref1: uistate.ref,
          ref2: ref,
          p: uistate.p,
        };

      case 'gg':
        return {
          type: 'ggp',
          ref,
          p1: uistate.p1,
          p2: uistate.p2,
        };

      case 'gp':
        return {
          type: 'gpp',
          ref1: uistate.ref,
          ref2: ref,
          p: uistate.p,
        };
    }
  }

  switch (uistate.type) {
    case 'none':
      return {
        type: 'g',
        p: mousePoint,
      };

    case 'g':
      return {
        type: 'gg',
        p1: uistate.p,
        p2: mousePoint,
      };

    case 'p':
      return {
        type: 'pg',
        ref: uistate.ref,
        p: mousePoint,
      };

    case 'pg':
      return {
        type: 'pgg',
        ref: uistate.ref,
        p1: uistate.p,
        p2: mousePoint,
      };

    case 'gp':
      return {
        type: 'gpg',
        ref: uistate.ref,
        p1: uistate.p,
        p2: mousePoint,
      };

    case 'pp':
      return {
        type: 'ppg',
        ref1: uistate.ref1,
        ref2: uistate.ref2,
        p: mousePoint,
      };
  }

  return {
    type: 'none',
  };
}

function onMouseUp(t: TDrawing, time: number, mouse: Point, state: TUserState) {
  if (!state.mouse) {
    return;
  }

  if (!state.mouse.movedWhileDown) {
    state.uistate = getUIState(state.uistate, state.mouse, mouse);

    // handle side effects
    const {uistate} = state;
    const theta = time * 0.005;
    switch (uistate.type) {
      case 'pgg':
      case 'gpg':
      case 'ggp': {
        const {p1, p2, ref} = uistate;
        Linkage.addJoint(linkage, theta, p1, p2, ref);
        state.uistate = {type: 'none'};
        break;
      }

      case 'gpp':
      case 'pgp':
      case 'ppg': {
        const {p, ref1, ref2} = uistate;
        Linkage.addCoupler(linkage, theta, p, ref1, ref2);
        state.uistate = {type: 'none'};
        break;
      }
    }
  }

  state.mouse = null;
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
  {
    linkage,
    mouse: null,
    uistate: {type: 'none'},
  },
);
