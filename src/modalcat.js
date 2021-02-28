// @ts-check
'use strict';

import React from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observer } from 'mobx-react'
import { Form, Button, Message, Modal, Table, Icon, Ref, Select } from 'semantic-ui-react'

import { serversDict } from './datasets.js'
import { findTapCatalog, findVizierCatalog, queryVizierTables } from './tap.js'

/**
 * @callback Dispatcher
 * @param {any} action
 * @return {any}
 */

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return { query: false, error: '', catalogs: [] };
    case 'startQuery':
      return { query: true, error: '', catalogs: [] };
    case 'stopQuery':
      return { query: false, error: (action.catalogs.length > 0 ? '' : 'No matching catalog found'), catalogs: action.catalogs };
    case 'errorQuery':
      return { query: false, error: action.error, catalogs: [] };
  }
  // The rest must be referred to a specific catalog. Find it!
  let catalog = _.find(state.catalogs, ['catid', action.catid]);
  switch (action.type) {
    case 'startSubQuery': {
      catalog.query = true;
      catalog.error = '';
      catalog.tables = [];
      return { ...state };
    }
    case 'stopSubQuery': {
      catalog.query = false;
      if (action.tables.length > 0) {
        catalog.error = '';
        catalog.tables = action.tables;
      } else catalog.error = 'No matching table found';
      return { ...state };
    }
    case 'errorSubQuery': {
      catalog.query = false;
      catalog.error = action.error;
      return { ...state };
    }
    case 'toggleDetails': {
      catalog.showDetails = !!!catalog.showDetails;
      return { ...state };
    }
  }
}


export const ModalTapSearch = observer((props) => {
  const scrollRef = React.useRef(null);
  const [openModal, setOpenModal] = React.useState(false);
  /** @type {[('title'|'name'), Dispatcher]} */
  const [searchType, setSearchType] = React.useState('title');
  const [searchValue, setSearchValue] = React.useState('');
  /** @type {[any, Dispatcher]} */
  const [state, dispatch] = React.useReducer(reducer, { query: false, error: '', catalogs: [] });
  const serverURL = (serversDict[props.server] || { server: '' }).server;
  const isVizier = serverURL === 'vizier';

  const doSearch = () => {
    dispatch({ type: 'startQuery' });
    let promise = isVizier ? findVizierCatalog(searchValue, searchType) : findTapCatalog(serverURL, searchValue, searchType);
    promise
      .then(result => dispatch({ type: 'stopQuery', catalogs: result }))
      .catch(error => dispatch({ type: 'errorQuery', error: error.toString() }));
  };

  const doSubSearch = (catid) => {
    let catalog = _.find(state.catalogs, ['catid', catid]);
    if (!catalog.tables || !catalog.tables.length) {
      dispatch({ type: 'startSubQuery', catid: catid });
      queryVizierTables(catid)
        .then(tables => dispatch({ type: 'stopSubQuery', catid: catid, tables: tables }))
        .catch(error => dispatch({ type: 'errorSubQuery', catid: catid, error: error.toString() }));
    }
  };

  let subcatalogs, lastcatalog;
  if (isVizier) {
    subcatalogs = [];
    lastcatalog = [];
    for (let l = 0; l < state.catalogs.length; l++) {
      let line = state.catalogs[l];
      lastcatalog.push(line);
      if (line.showDetails) {
        if (line.query) subcatalogs.push([lastcatalog, 'query']);
        else if (line.error) subcatalogs.push([lastcatalog, 'error']);
        else subcatalogs.push([lastcatalog, line.tables || []]);
        lastcatalog = [];
      }
    }
  } else {
    subcatalogs = [];
    lastcatalog = state.catalogs;
  }

  let header;
  if (isVizier)
    header = (
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={3}>Catalog</Table.HeaderCell>
          <Table.HeaderCell width={9}>Title</Table.HeaderCell>
          <Table.HeaderCell width={4}>Reference</Table.HeaderCell>
        </Table.Row>
      </Table.Header>);
  else
    header = (
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Table</Table.HeaderCell>
          <Table.HeaderCell>Title</Table.HeaderCell>
        </Table.Row>
      </Table.Header>);
  
  const FormServer = props.formServer || <></>;
  const options = [
    { text: 'Title', value: 'title' },
    { text: 'Name', value: 'name' }
  ];
  return (
    <Modal size='large' open={openModal} onClose={() => setOpenModal(false)}
      onOpen={() => setOpenModal(true)} trigger={<Button basic icon='search' />} >
      <Modal.Header>Catalog search</Modal.Header>
      <Ref innerRef={scrollRef}>
        <Modal.Content scrolling >
          <Form>
            <Form.Group>
              <Form.Input value={searchValue} onChange={(e, { value }) => setSearchValue(value)}
                width={10} placeholder='Catalog keywords' label='Catalog' action>
                <input />
                <Select compact options={options} value={searchType}
                  onChange={(e, { value }) => setSearchType(value)} />
                <Button onClick={doSearch}>Search</Button>
              </Form.Input>
              <FormServer />
            </Form.Group>
          </Form>
          {state.catalogs.length ?
            <>
              {_.map(subcatalogs, (catalogs, index) =>
                <React.Fragment key={index}>
                  <Table selectable attached='top'>
                    {header}
                    <Table.Body>
                      {_.map(catalogs[0], (line, index) =>
                        <Table.Row key={line.name}
                          onClick={(e) => {
                            if (e.target.tagName === 'TD' || e.target.tagName === 'I') {
                              if (isVizier) {
                                if (!line.showDetails) doSubSearch(line.catid);
                                dispatch({ type: 'toggleDetails', catid: line.catid });
                              } else {
                                setOpenModal(false);
                                props.onClick(e, line.name);
                              }
                            }
                          }} >
                          <Table.Cell>{isVizier ? <Icon link name={line.showDetails ? 'caret down' : 'caret right'} /> : <></>} {line.name}</Table.Cell>
                          <Table.Cell>{line.title}</Table.Cell>
                          {isVizier ?
                            <Table.Cell><a href={'https://ui.adsabs.harvard.edu/abs/' + line.bibcode} target='_blank'>
                              {line.bibcode}</a></Table.Cell>
                            : <></>}
                        </Table.Row>)}
                    </Table.Body>
                  </Table>
                  {catalogs[1] === 'query' ?
                    <Message attached='bottom' info content='Querying VizieR for all tables of the selected catalog...' />
                    : _.isString(catalogs[1]) ?
                      <Message attached='bottom' error header='Error' content={catalogs[1]} />
                      :
                      <Table attached='bottom' selectable>
                        <Table.Body>
                          {_.map(catalogs[1], line =>
                            <Table.Row positive key={line.name}
                              onClick={(e) => {
                                setOpenModal(false);
                                props.onClick(e, line.name);
                              }} >
                              <Table.Cell width={3}>{line.name.replace(/^.*\//, '')}
                              </Table.Cell>
                              <Table.Cell width={9}>{line.explain}</Table.Cell>
                              <Table.Cell width={4}>{line.records} rows</Table.Cell>
                            </Table.Row>)}
                        </Table.Body>
                      </Table>}
                </React.Fragment>
              )}
              {lastcatalog.length > 0 ?
                <Table selectable>
                  {header}
                  <Table.Body>
                    {_.map(lastcatalog, (line, index) =>
                      <Table.Row key={line.name}
                        onClick={(e) => {
                          if (e.target.tagName === 'TD' || e.target.tagName === 'I') {
                            if (isVizier) {
                              if (!line.showDetails) doSubSearch(line.catid);
                              dispatch({ type: 'toggleDetails', catid: line.catid });
                            } else {
                              setOpenModal(false);
                              props.onClick(e, line.name);
                            }
                          }
                        }}>
                        <Table.Cell>{isVizier ? <Icon name={line.showDetails ? 'caret down' : 'caret right'} /> : <></>} {line.name}</Table.Cell>
                        <Table.Cell>{line.title}</Table.Cell>
                        {isVizier ?
                          <Table.Cell><a href={'https://ui.adsabs.harvard.edu/abs/' + line.bibcode} target='_blank'>
                            {line.bibcode}</a></Table.Cell>
                          : <></>}
                      </Table.Row>)}
                  </Table.Body>
                </Table>
                : <></>}
            </>
            :
            <p>
              <br /> <br /> <br /> <br /> <br /> <br /> <br /> <br /> <br />
            </p>}
          {_.isString(state.query) ? <Message error header='Error' content={state.query} /> : <></>}
          {state.query === true ? <Message info header='Quering server'
            content='The server is being queried for tables containg your search terms.' /> : <></>}
        </Modal.Content>
      </Ref>
    </Modal>);
});
