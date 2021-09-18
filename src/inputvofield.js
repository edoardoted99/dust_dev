// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { FormField, Input, Modal, Radio, Button, Label, Table, Placeholder, Icon } from 'semantic-ui-react';
import { queryVizierNote } from './tap.js'


const VOTableDescription = (props) => {
  const [note, setNote] = React.useState(false);

  const handleOpen = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    setNote(true);
    // @ts-ignore
    queryVizierNote(props.catid, props.notid).then(setNote);
  }

  let { description, notid, disabled } = props;
  if (notid > 0 && !disabled) {
    let trigger;
    // Set the note trigger: usually a note is already present in the description at the end 
    // as a number in parentheses; if not present, add something like '(*)'.
    if (description.match(/\([0-9]+\)\s*$/)) {
      trigger = description.match(/\([0-9]+\)\s*$/)[0].trim();
      description = description.replace(/\s*\([0-9]+\)\s*$/, '');
    } else trigger = '(*)';
    return (
      <>
        {description + ' '}
        <Modal open={!!note} onOpen={handleOpen} onClose={() => setNote(false)}
          dimmer='inverted' trigger={<a>{trigger}</a>}>
          <Modal.Header>Note on {props.name}</Modal.Header>
          <Modal.Content scrolling>
            {note === true ? (
              <Placeholder style={{ minWidth: '400px' }}>
                <Placeholder.Header>
                  <Placeholder.Line />
                  <Placeholder.Line />
                </Placeholder.Header>
                <Placeholder.Paragraph>
                  <Placeholder.Line length='medium' />
                  <Placeholder.Line length='short' />
                </Placeholder.Paragraph>
              </Placeholder>
            ) : (
                <span dangerouslySetInnerHTML={{ __html: (note && note !== true) ? note : null }} />
              )}
          </Modal.Content>
        </Modal>
      </>);
  } else return description;
};


const VOTableDisplayer = (props) => {
  const [allCols, setAllCols] = React.useState(false);
  const showAllColsSwitch = (props.votable[0] && props.votable[0].default) !== undefined;

  const isHidden = field => {
    if (showAllColsSwitch && (!allCols) && (!field.default)) return true;
    if (props.hiddenFields) {
      if (_.isArray(props.hiddenFields))
        return (props.hiddenFields.indexOf(field.name) >= 0);
      else return props.hiddenFields(field);
    }
    return false;
  }

  const isDisabled = field => {
    if (props.disabledFields) {
      if (_.isArray(props.disabledFields))
        return props.disabledFields.indexOf(field.name) >= 0;
      else return props.disabledFields(field);
    }
    return false;
  }
  return (
    <>
      {showAllColsSwitch ?
        <Radio slider label='Show all columns' checked={allCols} onChange={() => setAllCols(!allCols)} />
        : <></>}
      <Table unstackable selectable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Description</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Unit</Table.HeaderCell>
            <Table.HeaderCell>UCD</Table.HeaderCell>
            <Table.HeaderCell>Indexed</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {_.map(_.filter(props.votable, field => !isHidden(field)), field =>
            <Table.Row key={field.name} active={field.name === props.value}
              disabled={field.name !== props.value && isDisabled(field)}
              onClick={(e) => props.onClick(e, field.name)} >
              <Table.Cell>{field.name}</Table.Cell>
              <Table.Cell>
                <VOTableDescription catid={props.catid} disabled={field.name !== props.value && isDisabled(field)}
                description={field.description || ''} notid={field.notid} />
              </Table.Cell>
              <Table.Cell>{field.datatype || '–'}</Table.Cell>
              <Table.Cell>{field.unit || ''}</Table.Cell>
              <Table.Cell>{field.ucd || ''}</Table.Cell>
              <Table.Cell collapsing textAlign='center'>{field.indexed == 1 ? <Icon name='check' /> : <></>}</Table.Cell>
            </Table.Row>)}
        </Table.Body>
      </Table>
    </>);
};


export const inputVOValidator = (value, props) => {
  const { votable, disabledFields } = props;
  let { missingMessage, duplicatedMessage } = props;
  let exists, duplicate, error;
  exists = _.findIndex(votable, ['name', value]) >= 0;
  duplicate = _.filter(disabledFields || [], field => field === value).length > 1;
  if (missingMessage === undefined || missingMessage === 'error')
    missingMessage = 'Enter a valid field';
  else if (missingMessage === 'ignore')
    missingMessage = '';
  if (duplicatedMessage === undefined)
    duplicatedMessage = (missingMessage === 'warn' || missingMessage === 'ignore') ? missingMessage : 'Duplicated field';
  else if (duplicatedMessage === 'ignore')
    duplicatedMessage = '';
  error = !exists ? missingMessage : duplicate ? duplicatedMessage : false;
  return error;
}


export const InputVOField = props => {
  const [openTable, setOpenTable] = React.useState(false);

  const handleChange = (e, o) => {
    setOpenTable(false);
    if (props.onChange) props.onChange(e, o);
  }

  const { value, label, disabledFields } = props;
  let error = props.error || (value !== '' && inputVOValidator(value, props));
  const inputProps = _.omit(props, ['label', 'width', 'error', 'onChange', 'action',
    'missingMessage', 'duplicatedMessage', 'votable', 'catid', 'disabledFields']);
  return (
    <FormField width={props.width} error={Boolean(error)}>
      {label ? <label>{label}</label> : <></>}
      <Input type='text' onChange={handleChange}
        action={
          <Modal size='large' open={openTable} onClose={() => setOpenTable(false)}
            onOpen={() => setOpenTable(true)} trigger={<Button basic icon='table' />} >
            <Modal.Header>Database columns</Modal.Header>
            <Modal.Content scrolling>
              <VOTableDisplayer votable={props.votable} catid={props.catid} disabledFields={disabledFields}
                hiddenFields={props.hiddenFields} value={value}
                onClick={(e, value) => handleChange(e, { ...inputProps, value })} />
            </Modal.Content>
          </Modal>
        } placeholder='Field name' {...inputProps} />
      {(error && error !== 'warn') ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
    </FormField>)
};
