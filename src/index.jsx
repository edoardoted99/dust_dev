// @ts-check
'use strict';

import React from 'react'
import ReactDOM from 'react-dom'

import 'semantic-ui-css/semantic.min.css'
import { Step } from 'semantic-ui-react'
import { MyForm0 } from './form0.mjs'
import { MyForm1 } from './form1.mjs'
import { observable } from 'mobx'
 
class MyApp extends React.Component {
  @observable configuration = [
    {
      catalog: '', server: '', bandlist: [], morphclass: '', filter: true
    },
    {
      objectName: '', coord: 'G',
      lonCtr: '', lonWdt: '', lonMin: '', lonMax: '', lonType: 0,
      latCtr: '', latWdt: '', latMin: '', latMax: '', latType: 0
    }];
  
  constructor(props) {
    super(props);
    this.state = {
      step: 0,
      states: [
        {
          catalog: '', server: '', bandlist: [], morphclass: '', filter: true,
          errors: {}, undo: false
        },
        {
          objectName: '', coord: 'G',
          lonCtr: '', lonWdt: '', lonMin: '', lonMax: '', lonType: 0,
          latCtr: '', latWdt: '', latMin: '', latMax: '', latType: 0,
          errors: {}, undo: false
        }],
    };
    this.setStep = this.setStep.bind(this);
    this.setStates = this.setStates.bind(this)
  }

  setStep(step) {
    this.setState({ step: step });
  }

  setStates(newState) {
    this.setState(s => { s.states[s.step] = { ...s.states[s.step], ...newState }; return s; });
  }

  render() {
    let form;
    switch (this.state.step) {
      case 0:
        form = (<MyForm0 state={this.state.states[0]} setState={this.setStates}
          onNext={(e, s) => this.setState({ step: 1 })} />);
        break;
      case 1:
        form = (<MyForm1 state={this.state.states[1]} setState={this.setStates}
          onNext={() => this.setState({ step: 2 })} onBack={() => this.setState({ step: 0 })} />);
        break;
    }
    return (<div>
      <AppStepGroup step={this.state.step} setStep={this.setStep} />
      {form}
    </div>);
  }
}
 

function AppStepGroup(props) {
  var step = props.step;
  var steps = [];
  var titles = ['Dataset', 'Science field', 'Control field', 'Map making'];
  var icons = ['database', 'crosshairs', 'eyedropper', 'map outline'];
  var descriptions = ['Select the database to use', 'Select the location of the science field',
    'Select the location of the control field', 'Set the final parameters'];
  var setStep = (s) => () => props.setStep(s)
  
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


export default MyApp;
