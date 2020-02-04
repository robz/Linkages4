/* @flow */

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');
const UI = require('./UI');

const linkage = Linkage.make({
  grounds: {
    p1: [0, 0],
    p4: [0.3, 0],
    p5: [-0.3, 0],
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
  sliders: [
  /*
    {
      len: 0.7,
      p1: 'p2',
      p2: 'p5',
      p3: 'p6',
    },
  */
  ],
});

Drawing.start(
  Drawing.make('canvas0', window),
  UI.draw,
  UI.onMouseDown,
  UI.onMouseMove,
  UI.onMouseUp,
  UI.onKeyDown,
  UI.make(linkage),
);
