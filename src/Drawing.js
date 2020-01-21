/* @flow */

export type TWindow = {|
  requestAnimationFrame: ((number) => void) => number,
  addEventListener: ('resize', () => void) => void,
  innerWidth: number,
  innerHeight: number,
|};
declare var window: TWindow;

export type Point = [number, number];

type Container = TWindow | HTMLElement;

export opaque type t = {
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  container: Container,
};

type TDrawingState = {
  isPaused: boolean,
  startTime: number,
  offsetTime: number,
  mouse: ?Point,
};

const SHOW_FPS = false;

function drawLines(t: t, points: Array<Point>) {
  const {ctx} = t;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1, len = points.length; i < len; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
}

function drawLine(t, x1, y1, x2, y2) {
  drawLines(t, [[x1, y1], [x2, y2]]);
}

function drawAxis(t: t) {
  drawLine(t, -0.9, 0, 0.9, 0);
  drawLine(t, 0, -0.9, 0, 0.9);
}

function drawCircle(t: t, x: number, y: number, r: number) {
  const {ctx} = t;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2, true);
  ctx.stroke();
}

function scaleCanvas(t: t) {
  const {canvas, ctx, container} = t;

  canvas.width =
    container instanceof HTMLElement
      ? container.clientWidth
      : container.innerWidth;
  canvas.height =
    container instanceof HTMLElement
      ? container.clientHeight
      : container.innerHeight;
  canvas.height -= 4; // weird scrollbar

  const scale = Math.min(canvas.width, canvas.height);
  ctx.scale(scale / 2, -scale / 2);
  ctx.lineWidth = 2 / scale;
  ctx.translate(1, -1);
  if (canvas.width < canvas.height) {
    ctx.translate(0, -canvas.height / scale + 1);
  } else {
    ctx.translate(canvas.width / scale - 1, 0);
  }
}

function clearCanvas(t: t) {
  const {canvas, ctx} = t;
  const scale = Math.min(canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(-canvas.width / scale, -canvas.height / scale, scale, scale);
}

function getPoint(t, canvasX, canvasY) {
  const {canvas} = t;
  const scale = Math.min(canvas.width, canvas.height);
  let x = (canvasX / scale) * 2 - 1;
  let y = (-canvasY / scale) * 2 + 1;
  if (canvas.width < canvas.height) {
    y += canvas.height / scale - 1;
  } else {
    x += -canvas.width / scale + 1;
  }
  return [x, y];
}

function start<TUserState>(
  t: t,
  draw: (t, number, ?Point, TUserState) => void,
  onMouseDown: (t, number, Point, TUserState) => void,
  onMouseMove: (t, number, Point, TUserState) => void,
  onMouseUp: (t, number, Point, TUserState) => void,
  userState: TUserState,
) {
  const state: TDrawingState = {
    isPaused: false,
    startTime: new Date().getTime(),
    offsetTime: 0,
    mouse: null,
  };

  let prevTime = null;
  let prevFPS = null;

  function animate(_time: number) {
    const time = new Date().getTime();
    const userTime =
      state.offsetTime + (state.isPaused ? 0 : time - state.startTime);
    draw(t, userTime, state.mouse, userState);

    if (SHOW_FPS && prevTime) {
      const fps = 1000 / (time - prevTime);
      if (prevFPS) {
        const fpsAvg = Math.round(fps * 0.5 + prevFPS * 0.5);
        t.ctx.scale(0.1, -0.1);
        t.ctx.font = '1px serif';
        t.ctx.fillStyle = 'black';
        t.ctx.fillText('fps: ' + fpsAvg, -10, -9);
        t.ctx.scale(10, -10);
      }
      prevFPS = fps;
    }
    prevTime = time;

    window.requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    scaleCanvas(t);
    draw(t, state.offsetTime, state.mouse, userState);
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === ' ') {
      const time = new Date().getTime();
      if (state.isPaused) {
        state.isPaused = false;
        state.startTime = time;
      } else {
        state.isPaused = true;
        state.offsetTime += time - state.startTime;
      }
    }
  });

  t.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    state.mouse = getPoint(
      t,
      e.clientX - t.canvas.offsetLeft,
      e.clientY - t.canvas.offsetTop,
    );
    onMouseMove(t, state.offsetTime, state.mouse, userState);
  });

  t.canvas.addEventListener('mousedown', (e: MouseEvent) => {
    state.mouse = getPoint(
      t,
      e.clientX - t.canvas.offsetLeft,
      e.clientY - t.canvas.offsetTop,
    );
    onMouseDown(t, state.offsetTime, state.mouse, userState);
  });

  t.canvas.addEventListener('mouseup', (e: MouseEvent) => {
    state.mouse = getPoint(
      t,
      e.clientX - t.canvas.offsetLeft,
      e.clientY - t.canvas.offsetTop,
    );
    onMouseUp(t, state.offsetTime, state.mouse, userState);
  });

  scaleCanvas(t);
  window.requestAnimationFrame(animate);
}

function make(canvasID: string, container: Container): t {
  const canvas = document.getElementById(canvasID);
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(canvasID + ' is not a canvas');
  }
  const ctx = canvas.getContext('2d');
  return {canvas, ctx, container};
}

module.exports = {
  drawLines,
  drawAxis,
  drawCircle,
  clearCanvas,
  start,
  make,
};
