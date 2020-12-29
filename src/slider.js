// @ts-check
'use strict';

import React from 'react'
import _ from 'lodash'
import { Progress } from 'semantic-ui-react'
import './slider.css'

/**
 * A functional component to display a slider.
 * 
 * The component is based on the `Semantic` `progress`-bar, with the addition of click events.
 * @param {Object} props - The full property list
 * @param {number} props.min - The minimum allowed value
 * @param {number} props.max - The maximum allowed value
 * @param {number} [props.step=1] - The step size
 * @param {number} props.value - The current value
 * @param {function=} props.onChange - Callback called on change events
 * @param {('tiny'|'small'|'medium'|'big')=} props.size - The requested size
 * @param {import('semantic-ui-react').SemanticCOLORS=} props.color - The slider's color
 */
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
