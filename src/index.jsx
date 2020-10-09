// @ts-check
'use strict';

import { action } from 'mobx';
import React from 'react'
import ReactDOM from 'react-dom'

import 'semantic-ui-css/semantic.min.css'
import { Step } from 'semantic-ui-react'
import _ from 'lodash'
import { MyForm0, state0 } from './form0.js'
import { MyForm1, state1 } from './form1.js'
import { MyForm2, state2 } from './form2.js'

export function MyApp(props) 
{
  const [step, setStep] = React.useState(0);
  let form;
  const saveStep0 = action(() => {
    state2.mask = state1.mask = state0.mask;
    state2.reddeningLaw = _.cloneDeep(state0.reddeningLaw);
    state2.bands = _.cloneDeep(state0.bandlist);
    state2._orig.reddeningLaw = _.cloneDeep(state0.reddeningLaw);
    state2._orig.bands = _.cloneDeep(state0.bandlist);
    });

  switch (step) {
    case 0:
      form = (<MyForm0 onNext={() => { setStep(1); saveStep0(); }} />);
      break;
    case 1:
      form = (<MyForm1 onNext={() => setStep(2)} onBack={() => setStep(0)} />);
      break;
    case 2:
      form = (<MyForm2 onNext={() => setStep(3)} onBack={() => setStep(1)}
        reddeningLaw={state0.bandsWithFields.reddeningLaw} />);
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
  const icons = ['database', 'crosshairs', 'eyedropper', 'map'];
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
