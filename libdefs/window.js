/* @flow */

declare interface Window {
  requestAnimationFrame: ((number) => void) => number;
  addEventListener: ('resize', () => void) => void;
  innerWidth: number;
  innerHeight: number;
  location: {|
    protocol: string,
    hash: string,
    host: string,
    pathname: string,
    search: string,
  |};
  history: {|
    pushState: ({[mixed]: mixed}, string, string) => void,
  |};
}

declare var window: Window;
