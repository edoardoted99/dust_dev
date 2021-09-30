// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Container, Message, Form, Header, Button, Icon, Divider } from 'semantic-ui-react'
import { CooFormState, CooForm } from './cooform.js'
import { Helper, HelperButton } from './helper.js';

configure({ enforceActions: 'observed' });

export const state1 = new CooFormState();
state1.step = 1;

const ClearButton = observer(() => {
  return (
    <Helper
      content={state1.undo ? 'Undo the last operation' : 'Cancel all fields and restore default values'}>
      <Button style={{ width: '110px' }} icon={state1.undo ? 'undo' : 'delete'} content={state1.undo ? 'Undo' : 'Clear'}
        color={state1.undo ? 'green' : 'red'} onClick={state1.resetOrUndo} />
    </Helper>
  );
});

const FormMessage = observer(() => {
  return (state1.messageType === null) ? <></> : <Message {...state1.messageProps} />;
});

export const MyForm1 = observer((props) => {
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
      <Form autoComplete='off'>
        <Header as='h2'>Area selection</Header>
        All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
        , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
        using the selection button (the square).
        <Divider hidden />
        <CooForm cooform={state1} />
        <p></p>
        <Helper content='Click to go back to the previous page'>
          <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
            onClick={handleBack} />
        </Helper>
        <ClearButton />
        <Helper content='When ready, click to proceed to the next page'>
          <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
            onClick={handleNext} />
        </Helper>
        <HelperButton />
        <Helper wide position='top right' content='Download the a (partial) configuration:
        the file can then be used on the first page to restore the parameters entered so far'>
          <Button icon='download' floated='right' onClick={props.downloader}/>
        </Helper>
      </Form>
      <FormMessage />
    </Container>);
});