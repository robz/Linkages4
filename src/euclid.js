/* @flow */

export type Point = [number, number];

function euclid([x1, y1]: Point, [x2, y2]: Point) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

module.exports = euclid;
