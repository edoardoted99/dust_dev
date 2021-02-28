
// @ts-check
'use strict';

import React from 'react'
import _ from 'lodash'
import { observer } from 'mobx-react'
import { FormField, Input, Label } from 'semantic-ui-react'

export const InputUnit = observer((props) => {
  const { name, label, unit } = props;
  // We cannot use directly state2.props below: the error appears in different components
  const { value, error, onChange } = props.state.props(name);
  return (
    <FormField error={Boolean(error)} width={props.width}>
      {label ? <label>{label}</label> : <></>}
      <Input name={name} value={value} onChange={onChange}
        label={unit ? { basic: true, content: unit } : null}
        labelPosition={unit ? 'right' : null}
        {..._.omit(props, ['name', 'value', 'label', 'unit', 'width'])} />
      {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
    </FormField>);
});
