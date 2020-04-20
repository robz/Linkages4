/* @flow */

import type {T as TLinkage} from './Linkage';

const Drawing = require('drawing');
const Linkage = require('./Linkage');
const LinkageURL = require('./LinkageURL');
const UI = require('./UI');
const {nullthrows} = require('flow_invariants');

const textarea = document.getElementById('linkage_serialized');
if (!(textarea instanceof HTMLTextAreaElement)) {
  throw new Error('no linkage_serialized text area');
}

let urlSaverJobID = null;
function writeSerializedLinkage(linkage: TLinkage) {
  const newValue = JSON.stringify(linkage);
  if (textarea.value === newValue) {
    return;
  }

  // save, throttled
  const jobID = setTimeout(() => {
    if (jobID !== urlSaverJobID) {
      return;
    }
    const newURL =
      window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname +
      '#' +
      LinkageURL.make(LinkageURL.VERSIONS[0], linkage);

    // save to URL
    window.history.pushState({path: newURL}, '', newURL);

    // save to visible textarea
    textarea.value = JSON.stringify(
      Linkage.decompress(Linkage.compress(linkage)),
    );
  }, 100);
  urlSaverJobID = jobID;
}

const defaultLinkageSpec = {
  grounds: {
    p1: [0, 0],
    /*
    p4: [0.3, 0],
    p5: [-0.3, 0],
    */
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
    /*
    {
      len1: 0.4,
      len2: 0.4,
      p1: 'p2',
      p2: 'p4',
      p3: 'p3',
    },
    */
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
};

const hash = window.location.hash;
const linkageSpec =
  hash.length > 1 ? LinkageURL.parse(hash) : defaultLinkageSpec;

const linkage = Linkage.make(linkageSpec, writeSerializedLinkage);
writeSerializedLinkage(linkage);

const defaultMode = 'hinge';
const ui = UI.make(linkage, defaultMode);

['rotary', 'hinge', 'slider'].forEach(id => {
  const button = document.getElementById(id);
  if (!(button instanceof HTMLInputElement)) {
    throw new Error(id + ' is not a radio button option');
  }
  button.onclick = () => UI.onChangeMode(ui, id);
  if (id === defaultMode) {
    button.checked = true;
  }
});

Drawing.start(
  Drawing.make('canvas0', window),
  UI.draw,
  UI.onMouseDown,
  UI.onMouseMove,
  UI.onMouseUp,
  UI.onKeyDown,
  ui,
);
