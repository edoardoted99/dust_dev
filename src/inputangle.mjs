// @ts-check
'use strict';

import React from 'react'
import { Form } from 'semantic-ui-react'

// Properties: value, onChange, onBlur, longitude, latitude, hms
export class InputAngle extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.state = { value: '' };
  }

  
  /**
   * Validate the current input
   *
   * @param {String} value The angle to validate
   * @param {boolean} [partial=false] If true, a partial input value is 
   *   acceptable
   * @return {boolean} Return true if the input value is valid
   * @memberof InputAngle
   */
  validate(value, partial = false) {
    if (partial) {
      if (this.props.type === 'latitude')
        return Boolean(value.match(/^([-–+](\d{1,2}(°(|\.\d*| (\d{1,2}('(|\.\d*| (\d{1,2}("(|\.\d*))?)?))?)?))?)?)?$/));
      else if (this.props.type === 'hms')
        return Boolean(value.match(/^(\d{1,3}(ʰ(|\.\d*| (\d{1,2}(ᵐ(|\.\d*| (\d{1,2}(ˢ(|\.\d*))?)?))?)?))?)?$/));
      else
        return Boolean(value.match(/^(\d{1,3}(°(|\.\d*| (\d{1,2}('(|\.\d*| (\d{1,2}("(|\.\d*))?)?))?)?))?)?$/));
    } else {
      if (this.props.type === 'latitude')
        return Boolean(value.match(/^([-–+]\d{1,2}°(|\.\d*| \d{1,2}'(|\.\d*| \d{1,2}"(|\.\d*))))$/));
      else if (this.props.type === 'hms')
        return Boolean(value.match(/^(\d{1,3}ʰ(|\.\d*| \d{1,2}ᵐ(|\.\d*| \d{1,2}ˢ(|\.\d*))))$/));
      else
        return Boolean(value.match(/^(\d{1,3}°(|\.\d*| \d{1,2}'(|\.\d*| \d{1,2}"(|\.\d*))))$/));
    }
  }

  /**
   * Fix an input value according to some specific rules
   *
   * @param {String} value The input value
   * @return {String} The fixed value
   * @memberof InputAngle
   * 
   * Allowed inputs are of the form –12° 34' 56".789, –12° 34'.567, +12°.3456.
   * For latitude fields the sign is not allowed. For hms fields the °'" are
   * relaced by ʰᵐˢ.
   * 
   * The original input value is taken to have fields separated by spaces or 
   * colums (:); for hms fields the h, m, and s letters are also acceptable.
   */
  fixInput(value) {
    let values, fixedValue, sign = '';
    if (this.props.type === 'latitude') {
      if (value.length > 0) {
        if (value[0] >= '0' && value[0] <= '9') sign = '+';
        else if (value[0] == '-' || value[0] == '–' || value[0] == '+') {
          sign = (value[0] == '+') ? '+' : '–';
          value = value.substr(1);
        }
      }
    }
    if (this.props.type === 'hms') {
      values = value.replace(/[^0-9.:hmsʰᵐˢ ]/g, '').split('.'), fixedValue = values[0];
      for (let n = 1; n < values.length; n++) {
        fixedValue += (n == 1 ? ' .' : '') + values[n].replace(/[ :hmsʰᵐˢ]/g, '');
      }
      fixedValue = fixedValue.replace(/^[ ]*/, '').replace(/[ :hʰ][ ]*/, 'ʰ').
        replace(/[ :mᵐ][ ]*/, "ᵐ").replace(/[ :sˢ][ ]*/, 'ˢ');
      fixedValue = fixedValue.replace(/([ʰᵐˢ])([0-9])/g, "$1 $2");
    } else {
      values = value.replace(/[^0-9.:°'" ]/g, '').split('.'), fixedValue = values[0];
      for (let n = 1; n < values.length; n++) {
        fixedValue += (n == 1 ? ' .' : '') + values[n].replace(/[ :°'"]/g, '');
      }
      fixedValue = fixedValue.replace(/^[ ]*/, '').replace(/[ :°][ ]*/, '°').
        replace(/[ :'][ ]*/, "'").replace(/[ :"][ ]*/, '"');
      fixedValue = fixedValue.replace(/([°'"])([0-9])/g, "$1 $2");
    }
    return sign + fixedValue;
  }

  handleChange(e, o) {
    let { value } = o, fixedValue = this.fixInput(value);
    if (this.validate(fixedValue, true)) {
      this.setState({ value: fixedValue });
      if (this.props.onChange) {
        let parsedValue = fixedValue.replace(/[°'"]/g, '').split(' ').map(parseFloat);
        // Fix negative values
        if (this.props.type === 'latitude' && (fixedValue[0] == '–' || fixedValue[0] == '-')) {
          for (let i = 1; i < parsedValue.length; i++)
            parsedValue[i] = -parsedValue[i];
        }
        o = { ...o, value: fixedValue, parsedValue: parsedValue };
        this.props.onChange(e, o);
      }
    }
  }

  handleBlur(e) {
    let fixedValue = this.fixInput(this.state.value + ' ');
    if (this.state.value != fixedValue) {
      this.setState({ value: fixedValue });
      if (this.props.onChange) this.props.onChange(e, { ...this.props, value: fixedValue });
    }
    if (this.props.onBlur) this.props.onBlur(e);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.type !== this.props.type) {
      let fixedValue = this.fixInput(this.state.value + ' ');
      if (this.state.value != fixedValue) {
        this.setState({ value: fixedValue });
        if (this.props.onChange) this.props.onChange(null, { ...this.props, value: fixedValue });
      }
    }
  }

  render() {
    return (
      <Form.Input value={this.state.value} {...this.props}
        type='text' onChange={this.handleChange} onBlur={this.handleBlur} />
    );
  }
}
