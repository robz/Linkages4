/* @flow */

declare module 'lz-string' {
  declare function compressToEncodedURIComponent(string): string;
  declare function decompressFromEncodedURIComponent(string): string;
}
