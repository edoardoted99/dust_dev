'use strict';

import React from 'react'

import 'semantic-ui-css/semantic.min.css'
import './sql.css'
import { Form, Header, Button, Accordion } from 'semantic-ui-react'
import { serversDict, datasetsDict, colorDict } from './datasets.js';

class SQLArea extends React.Component {
  state = { active: false }
  handleClick = () => (this.setState({ active: !this.state.active }))
  render() {
    const active = this.state.active;
    return (
      <Accordion fluid styled>
        <Accordion.Title content='ADQL query' active={active} icon='dropdown' onClick={this.handleClick} />
        <Accordion.Content active={active} content={this.props.content} />
      </Accordion>
    );
  }
}

export class MyForm0 extends React.Component {
  state = {
    catalog: '', server: '', bandlist: [], morphclass: '', filter: true,
    errors: {}, undo: false
  };

  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleToggle = this.handleToggle.bind(this);
    this.handleChangeCatalog = this.handleChangeCatalog.bind(this);
    this.handleChangeServer = this.handleChangeServer.bind(this);
    this.submit = this.submit.bind(this);
    this.clearOrUndo = this.clearOrUndo.bind(this);
  }

  handleChange(e, { name, value }) {
    this.setStateValidate({ [name]: value });
    this.setState({ undo: false });
  }

  handleToggle(e, { name, checked }) {
    this.setState({ [name]: checked, undo: false });
  }

  handleChangeCatalog(e, { name, value }) {
    let { server } = this.state;
    if (value) {
      let allowedServers = datasetsDict[value].servers;
      if (!allowedServers.includes(server)) {
        this.setStateValidate({ server: allowedServers[0] });
        this.updateFields(value, allowedServers[0]);
      } else this.updateFields(value, server);
    }
    this.setStateValidate({ [name]: value });
    this.setState({ undo: false });
  }

  handleChangeServer(e, { name, value }) {
    let { catalog } = this.state;
    if (value && catalog) this.updateFields(catalog, value);
    this.setStateValidate({ [name]: value });
    this.setState({ undo: false });
  }

  updateFields(catalog, server) {
    // Update the bands if necessary
    let bandlist = this.state.bandlist, allowedBands = datasetsDict[catalog].bands;
    if (allowedBands.constructor === Object) allowedBands = allowedBands[server];
    allowedBands = allowedBands.map((b, _) => b[0]);
    if ((bandlist.length == 0) ||
      (!bandlist.every(b => allowedBands.indexOf(b) > 0))) {
      this.setStateValidate({ bandlist: allowedBands });
    }
  }

  setStateValidate(dict) {
    for (let [name, value] of Object.entries(dict)) {
      this.validate(name, value);
    }
    return this.setState(dict);
  }

  validate(name, value) {
    const validations = {
      catalog: x => x != '',
      server: x => x != '',
      bandlist: x => (x.length >= 2)
    }
    if (name === undefined) {
      let errors = {}, hasErrors = false;
      for (let key of Object.keys(validations)) {
        if (validations[key] !== undefined) {
          let state = validations[key](this.state[key]);
          hasErrors |= !state;
          if (!state) errors[key] = true;
        }
      }
      this.setState({ errors: errors });
      return !hasErrors;
    } else if (validations[name] !== undefined) {
      if (this.state.errors[name]) {
        let state = validations[name](value), errors = this.state.errors;
        errors[name] = !state;
        this.setState({ errors: errors })
        return state;
      }
    }
  }

  submit(e) {
    if (!this.validate()) e.preventDefault();
    else this.props.onSubmit(e);
  }

  clearOrUndo() {
    if (!this.state.undo) {
      this.setState({
        catalog: '', server: '', bandlist: [], morphclass: '', filter: true,
        errors: {}, undo: Object.assign(this.state) 
      });
    } else {
      this.setState(this.state.undo);
    }
  }

  render() {
    let { catalog, server, bandlist, morphclass, filter } = this.state;
    // Set the catalog list
    const catalogs = Object.entries(datasetsDict).map(
      ([s, v], _) => ({ text: v.description, value: s, image: v.image })
    );
    // Set the server list
    let servers = [];
    if (catalog) {
      let allowedServers = datasetsDict[catalog].servers;
      for (let serverName of allowedServers) {
        let server = serversDict[serverName];
        servers.push({ text: server.description, value: serverName, image: server.image })
      }
    }
    // Set the coord list for the SQL query
    let fields = [], has_galactic;
    if (catalog && server) {
      let coords = datasetsDict[catalog].coords, has_galactic = 0;
      if (coords.constructor == Object) coords = coords[server];
      fields = [].concat(coords);
      coords = datasetsDict[catalog].gal_coords;
      if (coords) {
        if (coords.constructor == Object) coords = coords[server];
        if (coords) {
          fields.push(coords[0]);
          fields.push(coords[1]);
          has_galactic = 1;
        }
      }
    }
    // Set the band list
    let bands = [];
    if (catalog && server) {
      let allowedBands = datasetsDict[catalog].bands, lastColNum = -1, bandFields = [];
      if (allowedBands.constructor === Object) allowedBands = allowedBands[server];
      for (let band of Object.values(allowedBands).reverse()) {
        let name = band[0], colNum = colorDict.bands[name.toUpperCase().replaceAll("'", '')];
        if (colNum <= lastColNum) colNum = lastColNum + 1;
        bands.push({ text: band[0], value: band[0], color: colorDict.colorNames[colNum] });
        if (bandlist.indexOf(band[0]) >= 0) {
          bandFields.push(band[2]);
          bandFields.push(band[1]);
        }
        lastColNum = colNum;
      }
      bands.reverse();
      fields.push(...bandFields.reverse());
    }
    // Set the morphological class list
    let morphclasses = [];
    if (catalog && server) {
      let allowedClasses = datasetsDict[catalog].classes;
      if (allowedClasses.constructor === Object) allowedClasses = allowedClasses[server];
      for (let className of allowedClasses) {
        morphclasses.push({ text: className[0], value: className[0] });
        if (className[0] == morphclass) fields.push(className[1]);
      }
    }
    // Set the condition
    let conditions = [];
    if (catalog && server) {
      let extra = datasetsDict[catalog].extra;
      if (extra.constructor === Object) extra = extra[server];
      conditions.push(...extra);
      if (filter) {
        extra = datasetsDict[catalog].extra_robust
        if (extra.constructor === Object) extra = extra[server];
        conditions.push(...extra);
      }
    }
    // Compute the ADQL string
    let adql = '';
    if (catalog && server) {
      let catalogQuery = datasetsDict[catalog].catalogs, adqlQuery;
      if (catalogQuery.constructor == Object) catalogQuery = catalogQuery[server];
      if (Array.isArray(catalogQuery)) catalogQuery = catalogQuery.join(', ')
      adql =
        <div>
          <span className="sql-reserved">SELECT </span>
          {fields.map((f, _) => <span className="sql-field">{f}</span>)
            .reduce((acc, f) => (acc === null) ? f : <>{acc}, {f}</>)}<br />
          <span className="sql-reserved">FROM</span> {catalogQuery}
          {filter ? <><br />
            <span className="sql-reserved">WHERE </span>
            {conditions.map((c, _) => <><span className="sql-field">{c[0]}</span>
              <span className="sql-operator">{c[1]}</span>
              <span className="sql-constant">{c[2]}</span></>)
              .reduce((acc, c) => (acc === null) ? c : <>{acc} <span className="sql-simple-operator">AND</span> {c}</>)}
          </> : <></>}
        </div>;
    }
    let undo = Boolean(this.state.undo);

    return (<Form>
      <Header as='h2'>Dataset query</Header>
      <Header as='h3' dividing>Dataset selection</Header>
      <Form.Group>
        <Form.Select fluid width={10} name='catalog' value={catalog} label='Catalog'
          options={catalogs} placeholder='Catalog' onChange={this.handleChangeCatalog}
          error={this.state.errors.catalog && 'Please select a catalog'} />
        <Form.Select fluid width={6} name='server' value={server} label='Server'
          options={servers} placeholder='Server' onChange={this.handleChangeServer}
          error={this.state.errors.server && 'Please select a server'} />
      </Form.Group>
      <Form.Group>
        <Form.Dropdown fluid width={10} name='bandlist' value={bandlist} multiple search selection label='Bands'
          options={bands} placeholder='Select bands' onChange={this.handleChange}
          renderLabel={option => ({ color: option.color, content: option.text })}
          error={this.state.errors.bandlist && 'Select at least two bands'} />
        <Form.Dropdown fluid width={6} search selection clearable name='morphclass' value={morphclass}
          label='Morphological classification' options={morphclasses} placeholder='No classification'
          onChange={this.handleChange} />
      </Form.Group>
      <Header as='h3' dividing>Filters</Header>
      <Form.Checkbox name='filter' checked={filter} label='Filter spurious sources'
        onChange={this.handleToggle} />
      <Form.Field>
        <SQLArea content={adql} />
      </Form.Field>
      <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
        onClick={this.submit} />
      <Button style={{ width: "110px" }} icon={undo ? 'undo' : 'delete'} content={undo ? 'Undo' : 'Clear'}
        color={undo ? 'green' : 'red'} onClick={this.clearOrUndo} />
      <Button icon='upload' content='Upload configuration' />
    </Form>);
  }
}

