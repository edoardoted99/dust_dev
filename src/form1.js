// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Container, Dimmer, Message, Form, Header, Button, Icon, Divider } from 'semantic-ui-react'
import { CooFormState, CooForm } from './cooform.js'

configure({ enforceActions: 'observed' });

export const state1 = new CooFormState();
state1.step = 1;

const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state1.undo ? 'undo' : 'delete'} content={state1.undo ? 'Undo' : 'Clear'}
      color={state1.undo ? 'green' : 'red'} onClick={state1.resetOrUndo} />
  );
});

const FormMessage = observer(() => {
  return (state1.messageType === null) ? <></> : <Message {...state1.messageProps} />;
});

export const MyForm1 = observer((props) => {
  const [wait, setWait] = React.useState('');
  const [waitIcon, setWaitIcon] = React.useState('');

  const handleNext = action((e) => {
    e.preventDefault();
    if (state1.validate()) {
      state1.setMessage(0, true, null, () => {
        props.onNext(e);
      });
    }
  });

  function handleBack(e) {
    e.preventDefault();
    props.onBack(e);
  }

  return (
    <Container>
      <>
        <Dimmer active={Boolean(waitIcon)} page
          onClick={(e) => {
            if (waitIcon !== 'spinner') setWaitIcon('');
            if (waitIcon === 'check') props.onNext(e);
          }}>
          <Header as='h3' icon inverted>
            <Icon // @ts-ignore
              name={waitIcon} loading={waitIcon === 'spinner'} />
            {String(wait)}
          </Header>
        </Dimmer>
        <Form autoComplete='off'>
          <Header as='h2'>Area selection</Header>
          All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
          , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
          using the selection button (the square).
          <Divider hidden />
          <CooForm cooform={state1} />
          <p></p>
          <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
            onClick={handleBack} />
          <ClearButton />
          <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
            onClick={handleNext} />
          <Button icon='help' toggle floated='right' />
          <Button icon='download' floated='right' onClick={props.downloader}/>
        </Form>
        <FormMessage />
      </>
    </Container>);
});

