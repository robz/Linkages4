/* @flow */

function nullthrows<T>(x: ?T): T {
  if (x == null) {
    throw new Error('nullthrows');
  }
  return x;
}

function notNumberThrows(x: mixed): number {
  if (typeof x !== 'number') {
    throw new Error('not a number: ' + JSON.stringify(x));
  }
  return x;
}

function notTuple4NumberThrows(x: mixed): [number, number, number, number] {
  if (
    Array.isArray(x) &&
    typeof x[0] === 'number' &&
    typeof x[1] === 'number' &&
    typeof x[2] === 'number' &&
    typeof x[3] === 'number'
  ) {
    return [x[0], x[1], x[2], x[3]];
  }
  throw new Error('not a number: ' + JSON.stringify(x));
}

function notTuple5NumberThrows(
  x: mixed,
): [number, number, number, number, number] {
  if (
    Array.isArray(x) &&
    typeof x[0] === 'number' &&
    typeof x[1] === 'number' &&
    typeof x[2] === 'number' &&
    typeof x[3] === 'number' &&
    typeof x[4] === 'number'
  ) {
    return [x[0], x[1], x[2], x[3], x[4]];
  }
  throw new Error('not a number: ' + JSON.stringify(x));
}

module.exports = {
  nullthrows,
  notNumberThrows,
  notTuple4NumberThrows,
  notTuple5NumberThrows,
};
