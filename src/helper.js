// @ts-check
'use strict';

import React, { useState } from 'react'

import { observable, action } from 'mobx'
import { observer } from 'mobx-react'
import { Popup, Button } from 'semantic-ui-react'

/**
 * If true, hover help through popups is active
 * @type { object }
 */
export var helper = observable.box(false);

export const Helper = observer((props) => {
  return <Popup disabled={!helper.get()} content={props.content} wide={props.wide} position={props.position}
    trigger={props.children} />
});

export const HelperButton = observer((props) => {
  return (
    <Button icon='help' toggle active={helper.get()}
      onClick={
        action(() => helper.set(!helper.get()))
      } floated='right' />);
});
