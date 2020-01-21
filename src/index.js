/* @flow */

import type {Point, TWindow, t as TDrawing} from './Drawing';
import type {t as TLinkage, ref} from './Linkage';

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');

declare var window: TWindow;

type TUserState = {
  linkage: TLinkage,
  mouse: ?{
    point: ref,
    start: Point,
  },
};

function draw(
  drawing: TDrawing,
  time: number,
  mouse: ?Point,
  {linkage}: TUserState,
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
  const point = Linkage.getPoint(state.linkage, theta, mouse, 0.1);
  if (point) {
    state.mouse = {point, start: [...mouse]};
  }
}

function onMouseMove(
  t: TDrawing,
  time: number,
  mouse: Point,
  state: TUserState,
) {
  if (!state.mouse) {
    return;
  }
  const theta = time * 0.005;
  Linkage.movePoint(state.linkage, theta, state.mouse.point, mouse);
}

function onMouseUp(t: TDrawing, time: number, mouse: Point, state: TUserState) {
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
  },
);
