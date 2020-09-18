'use strict';

import React from 'react'
import ReactDOM from 'react-dom'

import 'semantic-ui-css/semantic.min.css'
import './sql.css'
import { Step, Container, Dimmer, Loader, Grid } from 'semantic-ui-react'
import { MyForm0 } from './form0.mjs'
import { MyForm1 } from './form1.mjs'
 
class MyApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      step: 0,
      wait: false,
    };
    this.setStep = this.setStep.bind(this);
  }
  setStep(step) {
    this.setState({ step: step });
  }
  render() {
    return (<div>
      <AppStepGroup step={this.state.step} setStep={this.setStep} />
      <Container>
        <Dimmer.Dimmable blurring dimmed={Boolean(this.state.wait)}>
          <Dimmer active={Boolean(this.state.wait)} inverted >
            <Loader inverted indeterminate content={String(this.state.wait)} />
          </Dimmer>
          <Grid stackable columns={2}>
            <Grid.Column style={{ flex: "1" }}>
              {this.state.step == 0 ?
                <MyForm0 onSubmit={() => this.setState({ step: 1 })} />
                :
                <MyForm1 onSubmit={() => this.setState({ step: 2 })} />}
            </Grid.Column>
            <Grid.Column style={{ flex: "0 0 300px" }}>
              Right form
            </Grid.Column>
          </Grid>
        </Dimmer.Dimmable>
      </Container>
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
  
  for (var i in [0, 1, 2, 3]) {
    steps.push({
      key: titles[i].replaceAll(" ", "-").toLowerCase(),
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
