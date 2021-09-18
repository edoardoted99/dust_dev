// @ts-check
'use strict';

import _ from 'lodash'
import { observable, action, isObservableProp, isComputedProp, when, computed } from 'mobx'

/// <reference path="" />

/**
 * @typedef Validator
 * @type {function}
 * @param {string} value - The value to validate.
 * @returns {false|string} - If `false`, the value is valid; otherwise, return the error message.
 */

/**
 * The complete state of a reactive form.
 * @export
 * @class FormState
 */
export class FormState {
  /** 
   * The current step in a multi-step form.
   * @type { number }
   * @memberof FormState
   */
  step = 0;

  /**
   * The list of validator functions associated to each observable.
   * 
   * The function should return `false` if the field is valid, and a string with error message otherwise.
   * @type {{[field: string]: Validator}}
   * @memberof FormState
   * 
   * In the current implementation, the list of validators is also used in index.jsx to update the state:
   * in case of a change of a validated variable, the state is reset. This is done with a mobx.reaction for
   * each validated variable. Therefore, *all* input values (i.e., all values that correspond to possible
   * use inputs) *must* have a validator; if all possible values are acceptable, the validator is an _empty_
   * validator that always returns false.
   * @example
   * validators = { 
   *   name: x => x === '' && 'Please enter your name',
   *   age: x => x > 0 && 'Your age must be positive',
   *   petName: x => false
   * }
   */
  validators = {};

  /**
   * The undo state.
   * 
   * If `false`, no undo is possible; otherwise, it is an object with the list
   * of properties to undo, when requested.
   * @type {false|{ [fieldName: string]: any}}
   * @memberof FormState
   */
  @observable undo = false;

  /**
   * The type of message to show at the end of the form.
   * @type {null|''|'message'|'success'|'info'|'warning'|'error'}
   * @memberof FormState
   */
  @observable messageType = null;

  /**
   * The header of the message to show at the end of the form.
   * @type {string}
   * @memberof FormState
   */
  @observable messageHeader = '';

  /**
   * The content of the message to show at the end of the form.
   * @type {string}
   * @memberof FormState
   */
  @observable messageContent = '';

  /**
   * The message properties associated to the current message.
   * @returns {Object} The message properties, as an object.
   * @memberof FormState
   */
  @computed({ keepAlive: true }) get messageProps() {
    if (this.messageType === null)
      return {};
    else if (this.messageType && this.messageType !== 'message')
      return { [this.messageType]: true, header: this.messageHeader, content: this.messageContent };
    else
      return { header: this.messageHeader, content: this.messageContent };
  }

  set messageProps(props) {
    if (!_.isEmpty(props)) {
      this.messageType = '';
      for (let p of ['success', 'warning', 'error', 'info'])
        // @ts-ignore
        if (props[p]) this.messageType = p;
      this.messageHeader = props.header;
      this.messageContent = props.content;
    } else {
      this.messageType = null;
      this.messageHeader = this.messageContent = '';
    }
  }

  /**
   * The class constructor: it just inizializes all fields to null.
   * @constructor
   * @memberof FormState
   */
  constructor() {
    /**
     * The initial settings of the observables.
     * @type {{ [fieldName: string]: any}}
     */
    this._orig = this.pull();
    /**
     * The list of error messages associated to each validated field.
     * @type { {[fieldName: string]: boolean|string;} }
     */
    this.errors = observable(_.mapValues(this.validators, () => null));
  }

  /**
   * Handle the change of an observable. 
   *
   * N.B. If the class has a method called `handle<name>`, this is called *before*
   * the rest of the code.
   * @param {React.SyntheticEvent} e - The event that triggered the call
   * @param {Object} o - The associated object: we read the `name`, and the `value` or `checked` fields.
   * @memberof FormState
   */
  @action.bound handleChange(e, o) {
    const { name, value, checked } = o;
    const path = _.toPath(name);
    const handlerName = 'handle' + _.join(_.map(path, word => word[0].toUpperCase() + word.substr(1)), '_');
    if (this[handlerName]) this[handlerName](e, o);
    if (!e.defaultPrevented) {
      _.set(this, path, (value !== undefined) ? value : checked);
      this.undo = false;
    }
  }

  /**
   * Return the values of all current observables.
   * @return {{ [fieldName: string]: any}} 
   * @memberof FormState
   */
  @action.bound pull() {
    return _.cloneDeep(_.pickBy(this, (v, k) => (k !== 'undo') && (k[0] !== '_') && isObservableProp(this, k) && (!isComputedProp(this, k))));
  }

  /**
   * Set the values of all current observables
   *
   * @param {{ [fieldName: string]: any}} orig The values to set
   * @memberof FormState
   */
  @action.bound push(orig) {
    _.assign(this, orig);
  }

  /**
   * Run all `validators` on the current values.
   *
   * This method updates `this.errors` and lanches a series of `when` 
   * watchers for all observables with errors: this way the errors will be
   * automagically cleaned when the observable is well formed.
   * @return {boolean} 
   * @memberof FormState
   */
  @action.bound validate() {
    let ok = true;
    for (let v in this.validators) {
      let validator = this.validators[v], errors = validator(this[v]);
      this.errors[v] = errors;
      if (_.isArray(errors) || _.isObject(errors)) {
        for (let e0 in errors) {
          let errors0 = errors[e0];
          if (_.isArray(errors0) || _.isObject(errors0)) {
            for (let e1 in errors0) {
              let errors1 = errors0[e1];
              if (_.isArray(errors1) || _.isObject(errors1)) {
                for (let e2 in errors1) {
                  let errors2 = errors1[e2];
                  if (errors2) {
                    when(() => !validator(this[v])[e0][e1][e2], () => this.errors[v][e0][e1][e2] = false);
                    ok = false;
                  }
                }
              } else {
                if (errors1) {
                  when(() => !validator(this[v])[e0][e1], () => this.errors[v][e0][e1] = false);
                  ok = false;
                }
              }
            }
          } else {
            if (errors0) {
              when(() => !validator(this[v])[e0], () => this.errors[v][e0] = false);
              ok = false;
            }
          }
        }
      } else {
        if (errors) {
          when(() => !validator(this[v]), () => this.errors[v] = false);
          ok = false;
        }
      }
    }
    return ok;
  }


  /**
   * Clear all errors.
   * @memberof FormState
   */
  @action.bound clearErrors() {
    for (let e in this.errors) {
      let error = this.errors[e];
      if (_.isObject(error)) _.assign(error, _.mapValues(error, () => false));
      else this.errors[e] = false;
    }
  }

  /**
   * Perform a reset or an undo of the observables.
   * @memberof FormState
   */
  @action.bound resetOrUndo() {
    if (this.undo) {
      this.push(this.undo);
      this.undo = false;
    } else {
      this.undo = this.pull(); 
      this.push(this._orig);
      this.clearErrors();
    }
  }

  /**
   * Return, for a given field, its `name`, `value`, `error`, and `onChange` handler.
   * @param {string} name - The field name to obtain
   * @returns {Object} A property list with the various fields.
   * @memberof FormState
   */
  props(name) {
    const value = _.get(this, name);
    const error = _.get(this.errors, name);
    const onChange = this.handleChange;
    return { name, value, error, onChange };
  }
}


