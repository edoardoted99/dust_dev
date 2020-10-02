// @ts-check
'use strict';

import React from 'react'
import ReactDOM from 'react-dom'

import 'semantic-ui-css/semantic.min.css'
import { Step } from 'semantic-ui-react'
import { MyForm0 } from './form0.js'
import { MyForm1 } from './form1.js'
import { observable } from 'mobx'


export function MyApp(props) 
{
  const [step, setStep] = React.useState(0);
  let form;
  switch (step) {
    case 0:
      form = (<MyForm0 onNext={() => setStep(1)} />);
      break;
    case 1:
      form = (<MyForm1 onNext={() => setStep(2)} onBack={() => setStep(0)} />);
      break;
  }

  return (
    <div>
      <AppStepGroup step={step} setStep={setStep} />
      {form}
    </div>
  );
}

function AppStepGroup(props) {
  const step = props.step;
  let steps = [];
  const titles = ['Dataset', 'Science field', 'Control field', 'Map making'];
  const icons = ['database', 'crosshairs', 'eyedropper', 'map outline'];
  const descriptions = ['Select the database to use', 'Select the location of the science field',
    'Select the location of the control field', 'Set the final parameters'];
  let setStep = (s) => () => props.setStep(s)
  
  for (let i of [0, 1, 2, 3]) {
    steps.push({
      key: titles[i].replaceAll(' ', '-').toLowerCase(),
      icon: icons[i],
      title: titles[i],
      description: descriptions[i],
      completed: step > i,
      active: step == i,
      disabled: step < i,
      onClick: setStep(i),
    });
  }
  return (<Step.Group widths={4} items={steps} />);
}

ReactDOM.render(
  <MyApp />,
  document.getElementById('root')
);
