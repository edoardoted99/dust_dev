// @ts-check
'use strict';

import React, { useState } from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from 'mobx-react'
import { Loader, Dimmer, Form, Header, Button, Accordion, Message } from 'semantic-ui-react'
import { serversDict, datasetsDict, colorDict } from './datasets.js'
import { FormState } from './formstate.js'


configure({ enforceActions: 'observed' });

export class Form0State extends FormState {
  @observable catalog = '';
  @observable server = '';
  @observable bandlist = [];
  @observable morphclass = '';
  @observable filter = false;

  validators = {
    catalog: x => x === '' && 'Please select a catalog',
    server: x => x === '' && 'Please select a server',
    bandlist: x => (x.length < 2) && 'At least two bands are required',
    // Empty validators
    morphclass: x => false,
    filter: x => false
  }

  catalogs = _.map(datasetsDict,
    (v, k) => ({ text: v.description, value: k, image: v.image })
  );

  @action.bound handleCatalog(e, { value }) {
    this.messageType = null;
    if (value) {
      let catalog = datasetsDict[value];
      let allowedServers = catalog.servers;
      if (!allowedServers.includes(this.server))
        this.server = allowedServers[0];
      let bands = catalog.bands;
      if (_.isPlainObject(bands)) bands = bands[this.server];
      this.bandlist = _.map(bands, (v) => v[0]);
      this.morphclass = '';
    }
  }

  @action.bound handleServer() {
    this.messageType = null;
  }

  @computed({ keepAlive: true }) get mask() {
    if (this.catalog) {
      const source = datasetsDict[this.catalog].mask || 'default';
      return `/static/masks/${source}.dzi`;
    } else return null;
  }

  @computed({ keepAlive: true }) get servers() {
    return _.map(this.catalog ? datasetsDict[this.catalog].servers : [],
      v => ({ text: serversDict[v].description, value: v, image: serversDict[v].image }));
  }

  @computed({ keepAlive: true }) get coords() {
    if (this.catalog && this.server) {
      let coords = datasetsDict[this.catalog].coords;
      if (this.server in coords) coords = coords[this.server];
      return coords;
    } else return {};
  }

  @computed({ keepAlive: true }) get bandsWithFields() {
    let result1 = [], result2 = {}, result3 = {};
    if (this.catalog && this.server) {
      let allowedBands = datasetsDict[this.catalog].bands, lastColNum = -1;
      if (_.isPlainObject(allowedBands)) allowedBands = allowedBands[this.server];
      for (let [name, mag, err, k] of Object.values(allowedBands).reverse()) {
        let colNum = colorDict.bands[name.toUpperCase().replaceAll("'", '')];
        if (colNum <= lastColNum) colNum = lastColNum + 1;
        result1.push({ text: name, value: name, color: colorDict.colorNames[colNum] });
        result2[name] = [mag, err];
        result3[name] = k;
        lastColNum = colNum;
      }
    }
    return { bands: result1.reverse(), fields: result2, reddeningLaw: result3 };
  }

  @computed({ keepAlive: true }) get bands() {
    return this.bandsWithFields.bands;
  }

  @computed({ keepAlive: true }) get morphclassesWithFields() {
    let result1 = [], result2 = {};
    if (this.catalog && this.server) {
      let allowedClasses = datasetsDict[this.catalog].classes;
      if (_.isPlainObject(allowedClasses)) allowedClasses = allowedClasses[this.server];
      for (let className of allowedClasses) {
        result1.push({ text: className[0], value: className[0] });
        result2[className[0]] = className[1];
      }
    }
    return { morphclasses: result1, fields: result2 };
  }

  @computed({ keepAlive: true }) get morphclasses() {
    return this.morphclassesWithFields.morphclasses;
  }

  @computed({ keepAlive: true }) get reddeningLaw() {
    return _.map(this.bandlist, b => this.bandsWithFields.reddeningLaw[b]);
  }

  @computed({ keepAlive: true }) get filterDisabled() {
    if (this.catalog && this.server) {
      let extra = datasetsDict[this.catalog].extra_robust
      if (_.isPlainObject(extra)) extra = extra[this.server];
      return extra.length === 0;
    } else return true;
  }

  @computed({ keepAlive: true }) get adqlComponents() {
    let fields = [], mags = [], magErrs = [], morphclass = null, extra, conditions = [];
    if (this.catalog && this.server) {
      let server = this.server, dataset = this.catalog, coords = this.coords;
      let catalogs = datasetsDict[dataset].catalogs;
      if (_.isPlainObject(catalogs)) catalogs = catalogs[server];
      if (!Array.isArray(catalogs)) catalogs = [catalogs];
      fields = [].concat(...Object.values(coords));
      mags = _.map(this.bandlist, b => this.bandsWithFields.fields[b][0]);
      magErrs = _.map(this.bandlist, b => this.bandsWithFields.fields[b][1]);
      fields = fields.concat(_.flatMap(this.bandlist, b => this.bandsWithFields.fields[b]));
      if (this.morphclass) {
        morphclass = this.morphclassesWithFields.fields[this.morphclass];
        fields.push(morphclass);
      }
      extra = datasetsDict[dataset].extra;
      if (_.isPlainObject(extra)) extra = extra[server];
      conditions.push(...extra);
      if (this.filter) {
        extra = datasetsDict[dataset].extra_robust
        if (_.isPlainObject(extra)) extra = extra[server];
        conditions.push(...extra);
      }
      let serverURL = serversDict[server].server;
      return { server: serverURL, dataset, catalogs, fields, conditions, coords, mags, magErrs, morphclass };
    } else return null;
  }

  @computed({ keepAlive: true }) get adql() {
    if (this.catalog && this.server) {
      let { fields, catalogs, conditions } = this.adqlComponents;
      return (
        <div>
          <span className="sql-reserved">SELECT </span>
          {fields.map((f) => <span className="sql-field">{f}</span>)
            .reduce((acc, f) => (acc === null) ? f : <>{acc}, {f}</>)}<br />
          <span className="sql-reserved">FROM</span> {catalogs.join(', ')}
          {conditions.length ? <><br />
            <span className="sql-reserved">WHERE </span>
            {conditions.map((c, _) => <><span className="sql-field">{c[0]}</span>
              <span className="sql-operator">{c[1]}</span>
              <span className="sql-constant">{c[2]}</span></>)
              .reduce((acc, c) => (acc === null) ? c : <>{acc} <span className="sql-simple-operator">AND</span> {c}</>)}
          </> : <></>}
        </div>);
    } else return (<></>);
  }
}

export const state0 = new Form0State();

const FormCatalog = observer((props) => {
  return (
    <Form.Select fluid width={10} {...state0.props('catalog')} label='Catalog'
      options={state0.catalogs} placeholder='Catalog' {...props} />
  );
});

const FormServer = observer((props) => {
  return (
    <Form.Select fluid width={6} {...state0.props('server')} label='Server'
      options={state0.servers} placeholder='Server' {...props} />
  );
});

const FormBands = observer((props) => {
  return (
    <Form.Dropdown multiple search selection fluid width={10} {...state0.props('bandlist')}
      label='Bands' options={state0.bands} placeholder='Select bands'
      renderLabel={option => ({ color: option.color, content: option.text })} {...props} />
  );
});

const FormMorhClass = observer((props) => {
  return (
    <Form.Dropdown fluid width={6} search selection clearable {...state0.props('morphclass')}
      label='Morphological classification' options={state0.morphclasses} placeholder='No classification'
      {...props} />
  );
});

const FormFilter = observer((props) => {
  return (
    <Form.Checkbox name='filter' checked={state0.filter && (!state0.filterDisabled)}
      disabled={state0.filterDisabled} label='Filter spurious sources'
      onChange={state0.handleChange} {...props} />
  );
});


const SQLArea = observer(() => {
  const [active, setActive] = React.useState(false);

  return (
    <Accordion fluid styled>
      <Accordion.Title content='ADQL query' active={active} icon='dropdown' onClick={() => setActive(!active)} />
      <Accordion.Content active={active} content={state0.adql} />
    </Accordion>
  );
});

const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state0.undo ? 'undo' : 'delete'} content={state0.undo ? 'Undo' : 'Clear'}
      color={state0.undo ? 'green' : 'red'} onClick={state0.resetOrUndo} />
  );
});

const FormMessage = observer(() => {
  return (state0.messageType === null) ? <></> : <Message {...state0.messageProps} />;
});

export function MyForm0(props) {
  const [wait, setWait] = useState('');

  const checkServer = action((e) => {
    e.preventDefault();
    if (state0.validate()) {
      // Check if the server is responding within 30 seconds
      const axios = require('axios').default;
      state0.messageType = 'info';
      state0.messageHeader = 'Checking server';
      state0.messageContent = 'The server is being contacted...';
      axios
        .post('/app/ping_server', state0.adqlComponents, { timeout: 30000 })
        .then(action(response => {
          state0.messageProps = response.data;
        }))
        .catch(action(error => {
          console.log(error);
          state0.messageType = 'error';
          state0.messageHeader = 'Server down';
          state0.messageContent = 'The server is not responding: please select a different server.';
        }));
    }
  })

  const handleNext = action((e) => {
    e.preventDefault();
    if (state0.validate()) props.onNext(e);
  });

  return (
    <>
      <Dimmer active={Boolean(wait)} page>
        <Header as='h2' inverted>
          <Loader inverted indeterminate content={String(wait)} />
        </Header>
      </Dimmer>
      <Form >
        <Header as='h2'>Dataset query</Header>
        <Header as='h3' dividing>Dataset selection</Header>
        <Form.Group>
          <FormCatalog />
          <FormServer />
        </Form.Group>
        <Form.Group>
          <FormBands />
          <FormMorhClass />
        </Form.Group>
        <Header as='h3' dividing>Filters</Header>
        <FormFilter />
        <Form.Field>
          <SQLArea />
        </Form.Field>

        <Button icon='phone' content='Check server' onClick={checkServer} />
        <ClearButton />
        <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
          onClick={handleNext} />
        <Button icon='help' toggle floated='right' />
        <Button as='label' htmlFor='file' icon='upload' floated='right' />
        <input type='file' id='file' hidden onChange={props.uploader} />
      </Form>
      <FormMessage />
    </>);
}