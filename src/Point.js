/* @flow */

export type T = [number, number];

function euclid([x1, y1]: T, [x2, y2]: T) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function euclidPath(path1: Array<T>, path2: Array<T>): number {
  if (path1.length !== path2.length) {
    throw new Error('path lengths must be equal');
  }
  let error = 0;
  for (let i = 0; i < path1.length; i++) {
    error += euclid(path1[i], path2[i]);
  }
  return error;
}

module.exports = {euclid, euclidPath};
