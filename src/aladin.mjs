// @ts-check
'use strict';

import React from 'react'

import './css/aladin.min.css';
import aladin from './external/aladin_mini.mjs';

alert('This is A:' + aladin);

export const appendScript = (scriptToAppend, onload=null) => {
  const script = document.createElement("script");
  script.src = scriptToAppend;
  script.charset = 'utf-8';
  script.async = true;
  if (onload) script.onload = onload;
  document.body.appendChild(script);
}

export const removeScript = (scriptToRemove) => {
  let allsuspects = document.getElementsByTagName("script");
  for (let i = allsuspects.length; i >= 0; i--) {
    if (allsuspects[i] && allsuspects[i].getAttribute("src") !== null
      && allsuspects[i].getAttribute("src").indexOf(`${scriptToRemove}`) !== -1) {
      allsuspects[i].parentNode.removeChild(allsuspects[i])
    }
  }
}

export class Aladin extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    // const aladin = require('./external/aladin.min.js');
    alert(aladin);
    let myAladin = aladin;
    alert(JSON.stringify(aladin));
    aladin.aladin('#aladin-lite-div', { survey: 'P/DSS2/color', fov: 60 });
    // aladin.setFov(1);;
  }

  render() {
    return (
      <div>
        <div id='aladin-lite-div' style={{ width: '300px', height: '300px' }} />
      </div>
    );
  }
}