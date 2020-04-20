/* @flow */

declare interface Json {
  stringify: mixed => string;
  parse: string => mixed;
}

declare var JSON: Json;
