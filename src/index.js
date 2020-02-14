/* @flow */

import type {T as TLinkage} from './Linkage';

const Drawing = require('./Drawing');
const Linkage = require('./Linkage');
const UI = require('./UI');
const nullthrows = require('./nullthrows');

const textarea = document.getElementById('linkage_serialized');
if (!(textarea instanceof HTMLTextAreaElement)) {
  throw new Error('no linkage_serialized text area');
}

let id = null;
function writeSerializedLinkage(linkage: TLinkage) {
  const newValue = Linkage.serialize(linkage);
  if (textarea.value === newValue) {
    return;
  }

  // save to UI
  textarea.value = newValue;

  // save to URL, throttled
  const myID = setTimeout(() => {
    if (myID !== id) {
      return;
    }
    const newURL =
      window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname +
      '?linkage=' +
      encodeURI(JSON.stringify(Linkage.compress(linkage)));
    window.history.pushState({path: newURL}, '', newURL);
  }, 100);
  id = myID;
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

const searchData = window.location.search.split('linkage=');
const linkageSpec = defaultLinkageSpec;
/*
  searchData.length === 2
    ? Linkage.decompress(JSON.parse(decodeURI(searchData[1])))
    : defaultLinkageSpec;
    */

const linkage = Linkage.make(linkageSpec, writeSerializedLinkage);
writeSerializedLinkage(linkage);

const ui = UI.make(linkage);

nullthrows(document.getElementById('slider')).onclick = () => {
  UI.onChangeMode(ui, 'slider');
  console.log(ui);
};

Drawing.start(
  Drawing.make('canvas0', window),
  UI.draw,
  UI.onMouseDown,
  UI.onMouseMove,
  UI.onMouseUp,
  UI.onKeyDown,
  ui,
);
