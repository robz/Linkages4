/* @flow */

import type {T as TLinkage, Spec} from './Linkage';

const Linkage = require('./Linkage');
const LZString = require('lz-string');

const VERSIONS = [0];

function make(version: number, linkage: TLinkage): string {
  switch (version) {
    case VERSIONS[0]:
      return `${VERSIONS[0]},${LZString.compressToEncodedURIComponent(
        JSON.stringify(Linkage.compress(linkage)),
      )}`;
  }
  throw new Error('unsupported version: ' + version);
}

function parse(hash: string): $Exact<Spec> {
  const [version, data] = hash.substring(1).split(',');
  switch (Number(version)) {
    case VERSIONS[0]:
      return Linkage.decompress(
        JSON.parse(LZString.decompressFromEncodedURIComponent(data)),
      );
  }
  throw new Error('unsupported version: ' + version);
}

module.exports = {
  make,
  parse,
  VERSIONS,
};
