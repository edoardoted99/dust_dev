// @ts-check
'use strict';

import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { action, reaction } from 'mobx';
import { observer } from 'mobx-react';

import 'semantic-ui-css/semantic.min.css'
import { Step, Grid, Container } from 'semantic-ui-react'
import _ from 'lodash'
import { MyForm0, state0 } from './form0.js'
import { MyForm1, state1 } from './form1.js'
import { MyForm2, state2 } from './form2.js'
import { MyForm3, FormSVG, state3 } from './form3.js'
import { MyForm4, state4, FitsPanel } from './form4.js'
import { Angle } from './angle.js';
import { downloadJSON } from './downloadJSON.js'
import { AladinForm } from './aladin.js'

// Next two lines needed just to make stuff work when I skip steps!
state3.state1 = state1;
state3.state2 = state2;

const states = [state0, state1, state2, state3, state4];

export function MyApp(props) 
{
  const [step, setStep] = React.useState(0);
  const [completed, setCompleted] = React.useState(-1);
  const cooforms = [null, state1, state2, null];
  const abortProcess = () => {
    const axios = require('axios').default;
    axios
      .post('/app/abort_process', {}, { timeout: 30000 })
      .then(action(response => {
      }))
      .catch(action(error => {
        console.log(error);
      }));
  };
  useEffect(() => {
    const reactions = [];
    for (let n of [0, 1, 2, 3]) {
      reactions.push(
        reaction(() => {
          let result = {};
          // @ts-ignore
          for (let k in states[n].validators) {
            // Alternatively, we could check that
            // isObservableProp(this, k) && (!isComputedProp(this, k)
            // but there are a number of exceptions (undo, state1, state2, job_urls...)
            result[k] = _.cloneDeep(states[n][k]);
          }
          return result;
        },
          (newval, oldval, myreaction) => {
            // trace();
            if (completed >= n) {
              console.log(`${completed} -> ${n - 1}`);
              if (completed >= 3 && n <= 2) {
                state4.state = 'wait';
                abortProcess();
              } else state4.state = 'wait';
              setCompleted(n - 1); 
            }
          }));
    }
    return () => { for (let r of reactions) r(); };
  }, [completed]);
  let form;

  const saveStep0 = action(() => {
    state1.messageType = state2.messageType = null;
    state1.adqlComponents = state2.adqlComponents = state0.adqlComponents;
    state2.reddeningLaw = _.cloneDeep(state0.reddeningLaw);
    state2.bands = _.cloneDeep(state0.bandlist);
    state2._orig.reddeningLaw = _.cloneDeep(state0.reddeningLaw);
    state2._orig.bands = _.cloneDeep(state0.bandlist);
    setCompleted(0);
    setStep(1);
  });
  const saveStep1 = action(() => {
    state3.state1 = state1;
    state3.setDefault();
    state1.lonType = state2.latType = 1;
    setCompleted(1);
    setStep(2);
  });
  const saveStep2 = action(() => {
    state2.lonType = state2.latType = 1;
    state3.state2 = state2;
    setCompleted(2);
    setStep(3);
  });
  const saveStep3 = action(() => {
    setCompleted(3);
    setStep(4);
  });
  const resetApp = action(() => {
    // FIXME: I would like to do the following, but this triggers a reaction and makes
    // completed = 2, which is not nice at all!
    state1.messageType = null;
    state2.messageType = null;
    state3.messageType = null;
    abortProcess();
    setCompleted(-1);
    setStep(0);
  });
  const uploader = (event) => {
    const file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = action((e) => {
      // @ts-ignore
      const data = JSON.parse(e.target.result);
      if (data.length > 0) {
        state0.push(data[0]);
        saveStep0();
      }
      if (data.length > 1) {
        state1.push(data[1]);
        saveStep1();
      }
      if (data.length > 2) {
        state2.push(data[2]);
        saveStep2();
      }
      if (data.length > 3) {
        state3.push(data[3]);
        saveStep3();
      }
    });
    reader.readAsText(file);
  };
  const pipelineData = () => {
    return {
      // Catalog URLs
      urls_cf: state2.job_urls,
      nstars_cf: state2.nstars,
      urls_sf: state1.job_urls,
      nstars_sf: state1.nstars,
      // Catalog parameters
      coords: state0.adqlComponents.coords,
      mags: state0.adqlComponents.mags,
      magErrs: state0.adqlComponents.magErrs,
      morphclass: state0.adqlComponents.morphclass,
      // XNICER parameters
      reddeningLaw: state2.reddeningLaw,
      numComponents: state2.numComponents,
      maxExtinction: state2.maxExtinction,
      extinctionSteps: state2.extinctionSteps,
      extinctionSubsteps: state2.extinctionSubsteps,
      // Control field selection
      starFraction: state2.starFraction / 100,
      areaFraction: state2.areaFraction / 100,
      // WCS parameters
      wcs: {
        naxis1: parseInt(state3.naxis1),
        naxis2: parseInt(state3.naxis2),
        crpix1: parseFloat(state3.crpix1),
        crpix2: parseFloat(state3.crpix2),
        crval1: (new Angle(state3.crval1, 'longitude')).degrees,
        crval2: (new Angle(state3.crval2, 'latitude')).degrees,
        coosys: state3.coosys,
        projection: state3.projection,
        scale: state3.scaleArcsec,
        crota2: parseFloat(state3.crota2),
        lonpole: parseFloat(state3.lonpole),
        latpole: parseFloat(state3.latpole),
        pv2: _.map(state3.pv2, pv => parseFloat(pv))
      },
      // Smoothing algorithm
      smoothpar: parseFloat(state3.smoothpar),
      clipping: parseFloat(state3.clipping),
      clipIters: state3.clipIters,
      // Requested products
      products: state3.products
    }
  }

  switch (step) {
    case 0:
      form = (<MyForm0 onNext={saveStep0} />);
      break;
    case 1:
      form = (<MyForm1 onNext={saveStep1} onBack={() => setStep(0)} adqlComponents={state0.adqlComponents}
        downloader={() => downloadJSON([state0.pull(), state1.pull()], 'xnicest.cfg')} />);
      break;
    case 2:
      form = (<MyForm2 state1={state1} onNext={saveStep2} onBack={() => setStep(1)}
        adqlComponents={state0.adqlComponents} reddeningLaw={state0.bandsWithFields.reddeningLaw}
        downloader={() => downloadJSON([state0.pull(), state1.pull(), state2.pull()], 'xnicest.cfg')} />);
      break;
    case 3:
      form = (<MyForm3 onNext={() => { setStep(3); saveStep3(); }} pipelineData={pipelineData} onBack={() => setStep(2)} 
        downloader={() => downloadJSON([state0.pull(), state1.pull(), state2.pull(), state3.pull()], 'xnicest.cfg')} />);
      break;
    case 4:
      form = (<MyForm4 onAbort={resetApp} products={state3.products} coosys={state3.coosys} />);
      break;
  }
  return (
    <div>
      <AppStepGroup step={step} completed={completed} setStep={setStep} />
      <Container>
        <Grid stackable columns='2'>
          <Grid.Column style={{ flex: "1" }}>
            {form}
          </Grid.Column>
          <Grid.Column style={{ width: "400px" }}>
            {step < 3 ?
              <AladinForm cooform={cooforms[step]} state0={state0} />
              : step == 3 ?
                <FormSVG state1={state1} />
                :
                <></>
            }
            <FitsPanel hidden={step != 4} state0={state0}/>
            </Grid.Column>
        </Grid>
      </Container>
    </div>
  );
}

const AppStepGroup = observer(props => {
  const step = props.step, completed = props.completed;
  let steps = [];
  const titles = ['Dataset', 'Science field', 'Control field', 'Map parameters', 'Computation'];
  const icons = ['database', 'crosshairs', 'certificate', 'map outline', 'cog'];
  const descriptions = ['Database selection', 'Location of the science field',
    'Location of the control field', 'Final parameters', 'Perform the analysis'];
  let setStep = (s) => () => props.setStep(s)
  
  for (let i of [0, 1, 2, 3, 4]) {
    const bug = i === 4 && completed >= 3 && state4.state === 'error';
    let stepDict = {
      key: titles[i].replaceAll(' ', '-').toLowerCase(),
      icon: { name: bug ? 'bug' : icons[i], color: bug ? 'red' : null, loading: i === 4 && state4.state === 'run' },
      title: titles[i],
      description: descriptions[i],
      completed: i <= completed || (i === 4 && state4.state === 'end' && completed >= 3),
      active: i == step,
      disabled: i > completed + 1
    };
    stepDict.onClick = setStep(i);
    steps.push(stepDict);
  }
  return (<Step.Group widths={5} items={steps} />);
});

ReactDOM.render(
  <MyApp />,
  document.getElementById('root')
);
