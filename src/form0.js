// @ts-check
'use strict';

import React, { useState } from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from 'mobx-react'
import { Loader, Dimmer, Form, Header, Button, Accordion, Message, FormField, Input, Label } from 'semantic-ui-react'
import { serversDict, datasetsDict, colorDict } from './datasets.js'
import { FormState } from './formstate.js'
import { InputUnit } from './inputunit.js'
import { InputVOField, inputVOValidator } from './inputvofield'
import { ModalTapSearch } from './modalcat.js'
import { queryTable, testServerQuery } from './tap.js'

configure({ enforceActions: 'observed' });

/**
 * Table 3 from Rieke & Lebovsky (1985), ApJ 288, 618: ratio A_lambda / A_V.
 * @type {{ [band: string]: number }}
 */
const RIEKE_LEBOVSKY_REDDENING = {
  'U': 1.531,
  'B': 1.324,
  'V': 1.000,
  'R': 0.748,
  'I': 0.482,
  'J': 0.282,
  'H': 0.175,
  'K': 0.112,
  'Ks': 0.112,
  '3-4um': 0.058,
  'W1': 0.058,
  '4-8um': 0.023,
  'W2': 0.023
};


export class Form0State extends FormState {
  @observable queryType = 'S';
  @observable standardCatalog = '';
  @observable customCatalog = '';
  @observable server = '';
  @observable bandselection = [];
  @observable smorphclass = '';
  @observable filter = 'N';
  @observable advFilters = [];
  @observable catalogProperties = { coords: {}, bandlist: [], columns: [], morphclass: '' };

  @computed({ keepAlive: true }) get usedBandList() {
    return _.map(this.catalogProperties.bandlist, 1).concat(_.map(this.catalogProperties.bandlist, 2));
  }
  
  @computed({ keepAlive: true }) get usedFilterList() {
    return _.map(this.advFilters, 'name');
  }

  validators = {
    standardCatalog: x => (this.queryType === 'S' && x === '') && 'Please select a catalog',
    customCatalog: x => (this.queryType === 'C' && x === '') && 'Please enter a catalog',
    server: x => x === '' && 'Please select a server',
    bandselection: x => (this.queryType === 'S' && x.length < 2) && 'At least two bands are required',
    catalogProperties: x => ({ 
      coords: 
        !(('E' in x.coords && x.coords.E.length === 2) ||
          ('G' in x.coords && x.coords.G.length === 2)) && 'Coords are malformed',
      bandlist:
        _.map(x.bandlist, b => ([
          b[0].length === 0 && 'Band name required',
          inputVOValidator(b[1], { votable: this.catalogProperties.columns, disabledFields: this.usedBandList }),
          inputVOValidator(b[2], { votable: this.catalogProperties.columns, disabledFields: this.usedBandList }),
          !(b[3] > 0) && 'Enter a positive value'
        ])),
      columns: _.map(x.columns, c => false),
      morphclass: x.morphclass !== '' &&
        inputVOValidator(x.morphclass, { votable: this.catalogProperties.columns, disabledFields: this.usedBandList })
    }),
    // Empty validators
    queryType: x => false,
    smorphclass: x => false,
    filter: x => false,
    advFilters: x => false
  }

  @computed({ keepAlive: true }) get catalog() {
    return this.queryType === 'S' ? this.standardCatalog : this.customCatalog;
  }

  set catalog(value) {
    if (this.queryType === 'S') this.standardCatalog = value;
    else this.customCatalog = value;
  }

  @computed({ keepAlive: true }) get bandlist() {
    let sbandlist = this.bandselection, cbandlist = _.map(this.catalogProperties.bandlist, 0);
    return this.queryType === 'S' ? sbandlist : cbandlist;
  }

  set bandlist(values) {
    if (this.queryType === 'S') this.bandselection = values;
  }

  @computed({ keepAlive: true }) get morphclass() {
    let smorphclass = this.smorphclass, cmorphclass = this.catalogProperties.morphclass;
    return this.queryType === 'S' ? smorphclass : cmorphclass;
  }

  set morphclass(value) {
    if (this.queryType === 'S') this.smorphclass = value;
  }

  standardCatalogs = _.map(datasetsDict,
    (v, k) => ({ text: v.description, value: k, image: v.image })
  );

  @action.bound handleQueryType(e, { value }) {
    // We need to compute "by hand" the catalog, sunce the catalog getter 
    // still uses the old value for queryType.
    let catalog = (value === 'S') ? this.standardCatalog : this.customCatalog;
    this.updateCatalogProperties(catalog, this.server, value);
  }

  @action.bound handleStandardCatalog(e, { value }) {
    this.messageType = null;
    if (value) {
      let catalog = datasetsDict[value];
      let allowedServers = catalog.servers;
      if (!allowedServers.includes(this.server))
        this.server = allowedServers[0];
      let bands = catalog.bands;
      if (_.isPlainObject(bands)) bands = bands[this.server];
      this.bandselection = _.map(bands, 0);
      this.morphclass = '';
      this.advFilters = [{ name: '', min: '', max: '' }];
      this.updateCatalogProperties(value, this.server, this.queryType);
    }
  }

  @action.bound handleServer(e, { value }) {
    this.messageType = null;
    this.morphclass = '';
    this.advFilters = [{ name: '', min: '', max: '' }];
    this.updateCatalogProperties(this.catalog, value, this.queryType);
  }

  @action.bound updateCatalogProperties(catalog, server, queryType) {
    if (catalog && server) {
      let serverURL = serversDict[server].server;
      if (queryType === 'S') {
        // If a standard query, the catalog is in reality a mnnemonic and 
        // not the real catalog name: conert it
        catalog = datasetsDict[catalog].catalogs;
        if (_.isPlainObject(catalog)) catalog = catalog[server];
        if (Array.isArray(catalog)) catalog = catalog[0];
      }
      this.messageType = 'info';
      this.messageHeader = 'Quering server';
      this.messageContent = 'Retriving catalog properties...';
      this.catalogProperties.coords = {};
      this.catalogProperties.bandlist = [];
      this.catalogProperties.columns = [];
      this.catalogProperties.morphclass = '';
      queryTable(serverURL, catalog)
        .then(action(result => {
          this.messageType = null;
          this.catalogProperties.coords = result.coords;
          if (result.bandlist.length > 0) 
            this.catalogProperties.bandlist = result.bandlist;
          else
            this.catalogProperties.bandlist = [['', '', '', '']];
          this.catalogProperties.columns = result.columns;
          this.catalogProperties.catid = result.catid;
          this.catalogProperties.tabid = result.tabid;
        }))
        .catch(action(error => {
          this.messageType = 'error';
          this.messageHeader = 'Error';
          this.messageContent = error.toString();
          this.catalogProperties.coords = [];
          this.catalogProperties.bandlist = [];
          this.catalogProperties.columns = [];
        }));
    } else {
      this.catalogProperties = { coords: {}, bandlist: [], columns: [], morphclass: '' };
      this.messageType = null;
      this.messageType = null;
    }
  }

  @computed({ keepAlive: true }) get mocs() {
    if (this.queryType === 'S' && this.catalog) {
      const mocs = datasetsDict[this.catalog].mocs || [];
      if (_.isArray(mocs)) return mocs;
      else return [mocs];
    } else return [];
  }

  @computed({ keepAlive: true }) get servers() {
    if (this.queryType === 'S') {
      return _.map(this.catalog ? datasetsDict[this.catalog].servers : [],
        v => ({ text: serversDict[v].description, value: v, image: serversDict[v].image }));
    } else {
      return _.map(serversDict, (s, k) => ({ text: s.description, value: k, image: s.image }));
    }
  }

  @computed({ keepAlive: true }) get coords() {
    if (this.catalog && this.server) {
      // FIXME: let coords = datasetsDict[this.catalog].coords;
      let coords = this.catalogProperties.coords || {};
      if (this.server in coords) coords = coords[this.server];
      return coords;
    } else return {};
  }

  @computed({ keepAlive: true }) get bandsWithFields() {
    let result1 = [], result2 = {}, result3 = {};
    if (this.catalog && this.server) {
      let allowedBands, lastColNum = -1;
      if (this.queryType === 'S')
        allowedBands = datasetsDict[this.catalog].bands;
      else
        allowedBands = this.catalogProperties.bandlist || [];
      if (_.isPlainObject(allowedBands)) allowedBands = allowedBands[this.server];
      for (let [name, mag, err, k] of Object.values(allowedBands).reverse()) {
        let colNum = Math.trunc(colorDict.bands[name.toUpperCase().replaceAll("'", '')]);
        if (colNum <= lastColNum && colNum < colorDict.colorNames.length - 1) colNum = lastColNum + 1;
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
      if (this.queryType === 'S') {
        let allowedClasses = datasetsDict[this.catalog].classes;
        if (_.isPlainObject(allowedClasses)) allowedClasses = allowedClasses[this.server];
        for (let className of allowedClasses) {
          result1.push({ text: className[0], value: className[0] });
          result2[className[0]] = className[1];
        }
      } else {
        let morphclass = this.catalogProperties.morphclass;
        result1 = [{ text: morphclass, value: morphclass }];
        result2[morphclass] = morphclass;
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
    if (this.catalog && this.server && this.queryType === 'S') {
      let extra = datasetsDict[this.catalog].extra_robust
      if (_.isPlainObject(extra)) extra = extra[this.server];
      return extra.length === 0;
    } else return true;
  }

  @computed({ keepAlive: true }) get adqlComponents() {
    let fields = [], mags = [], magErrs = [], morphclass = null, extra, conditions = [];
    if (this.catalog && this.server) {
      let server = this.server, dataset = this.catalog, coords = this.coords;
      let catalogs = (this.queryType === 'S') ? datasetsDict[dataset].catalogs : dataset;
      if (_.isPlainObject(catalogs)) catalogs = catalogs[server];
      if (!Array.isArray(catalogs)) catalogs = [catalogs];
      fields = [].concat(...Object.values(coords));
      let selectedMags = _.pick(this.bandsWithFields.fields, this.bandlist);
      mags = _.map(selectedMags, 0);
      magErrs = _.map(selectedMags, 1);
      fields = fields.concat(_.flatMap(selectedMags));
      if (this.morphclass) {
        morphclass = this.morphclassesWithFields.fields[this.morphclass];
        fields.push(morphclass);
      }
      extra = (this.queryType === 'S') ? datasetsDict[dataset].extra : [];
      if (_.isPlainObject(extra)) extra = extra[server];
      conditions.push(...extra);
      if (this.filter === 'S') {
        extra = (this.queryType === 'S') ? datasetsDict[dataset].extra_robust : [];
        if (_.isPlainObject(extra)) extra = extra[server];
        conditions.push(...extra);
      } else if (this.filter === 'C') {
        extra = [];
        for (let f of this.advFilters) {
          let col = _.find(this.catalogProperties.columns, ['column_name', f.name]);
          let name = f.name;
          if (!col) continue;
          if (!name.match(/^[A-Za-z_]+[A-Za-z0-9_]*/)) name = `"${name}"`;
          if (col.datatype.substr(0, 4) !== 'CHAR') {
            const m1 = f.min.match(/^\s*[-+]?[0-9]+\.?[0-9]*$/), m2 = f.max.match(/^\s*[-+]?[0-9]+\.?[0-9]*$/);
            const o1 = m1 ? '>=' : '', o2 = m2 ? '<=' : '', s1 = f.min.trim(), s2 = f.max.trim();
            if (this.server === 'VizieR') {
              if (s1 && s2) extra.push([name, ' ', `${o1}${s1} & ${o2}${s2}`]);
              else if (s1) extra.push([name, o1, s1]);
              else if (s2) extra.push([name, o2, s2]);
            } else {
              if (s1) extra.push([name, o1, s1]);
              if (s2) extra.push([name, o2, s2]);
            }
          } else {
            const m1 = f.min.match(/^\s*[A-Za-z0-9_]+$/), s1 = f.min.trim();
            if (s1 === '') continue;
            if (this.server === 'VizieR') {
              if (m1) extra.push([name, '==', `"${s1}"`]);
              else extra.push(name, ' ', s1);
            } else {
              if (m1) extra.push([name, '=', `'${s1}'`]);
              else extra.push([name, ' ', s1]);
            }
          }
        }
        conditions.push(...extra);
      }
      let serverURL = serversDict[server].server;
      return { server: serverURL, dataset, catalogs, fields, conditions, coords, mags, magErrs, morphclass };
    } else return null;
  }

  @computed({ keepAlive: true }) get adql() {
    if (this.catalog && this.server) {
      let { fields, catalogs, conditions } = this.adqlComponents;
      if (fields.length === 0 || catalogs.length === 0) return <></>;
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

const FormCustomQuery = observer((props) => {
  return (
    <>
      <Form.Group inline>
        <Form.Radio label='Standard query' name='queryType' value='S'
          checked={state0.queryType === 'S'} onChange={state0.handleChange} {...props} />
        <Form.Radio label='Custom query' name='queryType' value='C'
          checked={state0.queryType === 'C'} onChange={state0.handleChange} {...props} />
      </Form.Group>
    </>
  );
});


const FormCatalog = observer((props) => {
  const modalClick = action((e, name) => {
    state0.customCatalog = name;
    state0.updateCatalogProperties(name, state0.server, state0.queryType)
  });

  if (state0.queryType === 'S') {
    return (
      <Form.Select fluid width={10} {...state0.props('standardCatalog')} label='Catalog'
        options={state0.standardCatalogs} placeholder='Catalog' {...props} />
    );
  } else {
    let error = '';
    return (
      <FormField error={Boolean(error)} width={10}>
        <label>Catalog</label>
        <Input type='text' {...state0.props('customCatalog')}
          onBlur={() => state0.updateCatalogProperties(state0.catalog, state0.server, state0.queryType)}
          action={<ModalTapSearch server={state0.server} formServer={FormServer} onClick={modalClick} />}
          placeholder='Catalog full name' />
        {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
      </FormField>
    );
  }
});

const FormServer = observer((props) => {
  return (
    <Form.Select fluid width={6} {...state0.props('server')} label='Server'
      options={state0.servers} placeholder='Server' {...props} />
  );
});

const FormBands = observer((props) => {
  return (
    <Form.Dropdown multiple search selection fluid width={10} {...state0.props('bandselection')}
      label='Bands' options={state0.bands} placeholder='Select bands'
      renderLabel={option => ({ color: option.color, content: option.text })} {...props} />
  );
});

const FormAdvBands = observer((props) => {
  let units = { '': '' }, descriptions = { '': '' }, numtypes = { '': '' };
  for (let col of state0.catalogProperties.columns) {
    units[col.column_name] = col.unit === 'deg' ? '°' : col.unit === undefined ? '' : col.unit;
    descriptions[col.column_name] = col.description || '';
    numtypes[col.column_name] = col.datatype.substr(0, 4) !== 'CHAR';
  }

  const lineMaker = (filter, idx) => {
    const line = (
      <Form.Group key={idx}>
        <Form.Input width={2} type='text' label={idx === 0 ? 'Name' : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][0]`)} placeholder='name' />
        <InputVOField width={4} label={idx === 0 ? 'Magnitude' : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][1]`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          disabledFields={state0.usedBandList} placeholder='magnitude' />
        <InputVOField width={4} label={idx === 0 ? 'Magnitude error' : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][2]`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          disabledFields={state0.usedBandList} placeholder='magnitude error' />
        <Form.Input width={4} label={idx === 0 ? (<label>A<sub>mag</sub> / A<sub>ref</sub></label>) : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][3]`)} placeholder='reddening law' type='text'
          action={{
            icon: 'magic', basic: true,
            onClick: action(() => {
              let name = state0.catalogProperties.bandlist[idx][0];
              if (name in RIEKE_LEBOVSKY_REDDENING) 
                state0.catalogProperties.bandlist[idx][3] = RIEKE_LEBOVSKY_REDDENING[name];
            })
          }} />
        <Form.Field width={2}>
          {idx === 0 ? <label>&nbsp;</label> : ''}
          <Button.Group size='mini' basic style={{ marginTop: '4px' }}>
            <Button icon='minus' disabled={idx === 0 && state0.catalogProperties.bandlist.length == 1}
              onClick={action(e => state0.catalogProperties.bandlist.splice(idx, 1))} />
            <Button icon='plus'
              onClick={action(e => state0.catalogProperties.bandlist.splice(idx + 1, 0, ['', '', '', '']))} />
          </Button.Group>
        </Form.Field>
      </Form.Group>
    );
    return line;
  }

  return (
    <>
      <Header as='h3' dividing>Bands and morphological class selection</Header>
      { state0.catalogProperties.bandlist.length == 0 ? 
        'You will be able to define the catalog bands and morphological class fields here after the server has been queried.' : <></>}
      { _.map(state0.catalogProperties.bandlist, lineMaker)}
      { state0.catalogProperties.bandlist.length == 0 ? <></> :
        <Form.Group>
          <InputVOField width={6} label='Morphological class (optional)' disabledFields={state0.usedBandList}
            placeholder='Morphological class' {...state0.props(`catalogProperties.morphclass`)}
            votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          />
        </Form.Group>
      }
    </>
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
    <>
      <Form.Group inline>
        <Form.Radio label='No filter' name='filter' value='N'
          checked={state0.filter === 'N'} onChange={state0.handleChange} {...props} />
        <Form.Radio label='Remove purious sources' name='filter' value='S'
          checked={state0.filter === 'S'} onChange={state0.handleChange} disabled={state0.filterDisabled} {...props} />
        <Form.Radio label='Custom filter' name='filter' value='C'
          checked={state0.filter === 'C'} onChange={state0.handleChange} {...props} />
      </Form.Group>
      { state0.filter === 'C' ? <FormAdvFilters {...props} /> : <></>}
    </>
  );
});

const FormAdvFilters = observer((props) => {
  let units = { '': '' }, descriptions = { '': '' }, numtypes = { '': '' };
  for (let col of state0.catalogProperties.columns) {
    units[col.column_name] = col.unit === 'deg' ? '°' : col.unit === undefined ? '' : col.unit;
    descriptions[col.column_name] = col.description || '';
    numtypes[col.column_name] = col.datatype.substr(0, 4) !== 'CHAR';
  }

  const lineMaker = (filter, idx) => {
    const name = state0.advFilters[idx].name;
    const doubleEntry = numtypes[name] &&
      (state0.advFilters[idx].min.match(/^\s*(>|>=|)\s*[-+]?[0-9]*(\.[0-9]*)?\s*$/) ||
        state0.advFilters[idx].max.trim() !== '');
    const line = (
      <Form.Group key={`advFilter${idx}`}>
        <InputVOField width={6} {...state0.props(`advFilters[${idx}].name`)} votable={state0.catalogProperties.columns}
          missingMessage='warn' catid={state0.catalogProperties.catid} disabledFields={state0.usedFilterList} /> 
       {name === '' ?
          <></> :
          <>
            <InputUnit fluid width={doubleEntry ? 4 : 8} name={`advFilters[${idx}].min`}
              placeholder={doubleEntry ? '> min value' : 'condition'}
              unit={units[name]} state={state0} />
            {doubleEntry ?
              <InputUnit fluid width={4} name={`advFilters[${idx}].max`} placeholder='< max value'
                unit={units[name]} state={state0} />
              : <></>
            }
          </>
        }
        <div style={{ alignItems: 'center', display: 'flex', marginLeft: '10px' }}>
          <Button.Group size='mini' basic>
            <Button icon='minus' disabled={idx == 0 && state0.advFilters.length == 1}
              onClick={action(e => state0.advFilters.splice(idx, 1))} />
            <Button icon='plus' disabled={name === '' ||
              state0.advFilters.length == state0.catalogProperties.columns.length}
              onClick={action(e => state0.advFilters.splice(idx + 1, 0, { name: '', min: '', max: '' }))} />
          </Button.Group>
        </div>
      </Form.Group>
    );
    return line;
  }

  return (
    <>
      { _.map(state0.advFilters, lineMaker)}
    </>
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

export const MyForm0 = observer((props) => {
  const [wait, setWait] = useState('');

  const checkServer = action((e) => {
    e.preventDefault();
    if (state0.validate()) {
      // Check if the server is responding within 30 seconds
      let comps = state0.adqlComponents;
      state0.messageType = 'info';
      state0.messageHeader = 'Checking...';
      state0.messageContent = 'The server is being contacted and the query checked.';
      testServerQuery(serversDict[state0.server].server, comps.catalogs[0], comps.fields, comps.conditions)
        .then(action(result => {
          state0.messageType = 'success';
          state0.messageHeader = 'Server checked';
          state0.messageContent = 'The server has been contacted: the catalog is present and the query is syntactically correct.';
        }))
        .catch(action(error => {
          state0.messageType = 'error';
          state0.messageHeader = 'Server checked';
          state0.messageContent = error.toString();
          console.log(error);
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
      <Form autoComplete='off'>
        <Header as='h2'>Dataset query</Header>
        <Header as='h3' dividing>Dataset selection</Header>
        <FormCustomQuery />
        <Form.Group>
          <FormCatalog />
          <FormServer />
        </Form.Group>
        {state0.queryType === 'S' ?
          <Form.Group>
            <FormBands />
            <FormMorhClass />
          </Form.Group>
          :
          <>
            <FormAdvBands />
          </>}
        <Header as='h3' dividing>Dataset filters</Header>
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
});