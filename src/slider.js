// @ts-check
'use strict';

import React from 'react'
import _ from 'lodash'
import { Progress } from 'semantic-ui-react'
import './slider.css'

export const Slider = (props) => {
  const slideRef = React.useRef(null);
  const { min, max, step, value } = props;

  const handleClick = (e) => {
    const bbox = slideRef.current.getBoundingClientRect();
    let value = (e.clientX - bbox.left) / bbox.width * (max - min);
    if (step)
      value = Math.round(value / step) * step + min;
    else
      value += min;
    if (props.onChange) props.onChange(e, value);
  }

  let percent = (step ? (Math.round((value - min) / step) * step) : (value - min)) / (max - min) * 100;
  if (percent < 0) percent = 0;
  else if (percent > 100) percent = 100;

  return (
    <div ref={slideRef}>
      <Progress className='slider' percent={percent} onClick={handleClick}
        onMouseMove={(e) => { if (e.buttons === 1) handleClick(e); } }
        {..._.omit(props, ['min', 'max', 'step', 'value', 'onChange', 'onClick', 'ref'])} />
    </div>
  );
}
