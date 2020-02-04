/* @flow */

declare interface Window {
  requestAnimationFrame: ((number) => void) => number,
  addEventListener: ('resize', () => void) => void,
  innerWidth: number,
  innerHeight: number,
};

declare var window: Window;
