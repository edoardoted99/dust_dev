// @ts-check
'use strict';

import React from 'react'
import ReactDOM from 'react-dom'
import { action } from 'mobx';
import { observer } from 'mobx-react';

import 'semantic-ui-css/semantic.min.css'
import { Step, Grid, Container } from 'semantic-ui-react'
import _ from 'lodash'
import { MyForm0, state0 } from './form0.js'
import { MyForm1, state1 } from './form1.js'
import { MyForm2, state2 } from './form2.js'
import { MyForm3, FormSVG, state3 } from './form3.js'
import { OpenSeaDragonViewer } from './openseadragon.js'
import { Angle } from './angle'

state1.lonMin = '0';
state1.lonMax = '20';
state1.latMin = '70';
state1.latMax = '85';

const Map = observer((props) => {
  if (state0.mask) {
    return (<OpenSeaDragonViewer image={state0.mask} scalebar {...props} />);
  } else return (<></>);
})


export function MyApp(props) 
{
  const [step, setStep] = React.useState(0);
  const cooforms = [null, state1, state2, null]
  let form;
  const saveStep0 = action(() => {
    state2.mask = state1.mask = state0.mask;
    state2.reddeningLaw = _.cloneDeep(state0.reddeningLaw);
    state2.bands = _.cloneDeep(state0.bandlist);
    state2._orig.reddeningLaw = _.cloneDeep(state0.reddeningLaw);
    state2._orig.bands = _.cloneDeep(state0.bandlist);
  });
  const saveStep1 = action(() => {
    state3.state1 = state1;
    state3.setDefault();
    state1.lonType = state2.latType = 1;
  });
  const saveStep2 = action(() => {
    state2.lonType = state2.latType = 1;
  });

  console.log(`1: ${state1.lonCtr};   2: ${state2.lonCtr}`);

  switch (step) {
    case 0:
      form = (<MyForm0 onNext={() => { setStep(1); saveStep0(); }} />);
      break;
    case 1:
      form = (<MyForm1 onNext={() => { setStep(2); saveStep1(); }} onBack={() => setStep(0)} />);
      break;
    case 2:
      form = (<MyForm2 state1={state1} onNext={() => { setStep(3); saveStep2(); }}
        onBack={() => {setStep(1); saveStep2();}}
        reddeningLaw={state0.bandsWithFields.reddeningLaw} />);
      break;
    case 3:
      form = (<MyForm3 onNext={() => setStep(3)} onBack={() => setStep(2)} />);
      break;
  }
  return (
    <div>
      <AppStepGroup step={step} setStep={setStep} />
      <Container>
        <Grid stackable columns={2}>
          <Grid.Column style={{ flex: "1" }}>
            {form}
          </Grid.Column>
          <Grid.Column style={{ width: "400px" }}>
            {step < 3 ?
              <Map select={step === 0 ? 'disabled' : true} cooform={cooforms[step]} />
              :
              <FormSVG state1={state1} />
            }
          </Grid.Column>
        </Grid>
      </Container>
    </div>
  );
}

function AppStepGroup(props) {
  const step = props.step;
  let steps = [];
  const titles = ['Dataset', 'Science field', 'Control field', 'Map making'];
  const icons = ['database', 'crosshairs', 'certificate', 'map outline'];
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
