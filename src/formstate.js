// @ts-check
'use strict';

import _ from 'lodash'
import { observable, action, isObservableProp, isComputedProp, when } from 'mobx'
import { observer } from 'mobx-react'


/// <reference path="" />

/**
 * The complete state of a reactive form.
 *
 * @export
 * @class FormState
 */
export class FormState {
  /**
   * The list of validator functions associated to each observable.
   * @type {Object}
   * @memberof FormState
   * @example
   * validators = { 
   *   name: () === '' && 'Please enter your name',
   *   age: () > 0 && 'Your age must be positive'
   * }
   */
  validators = {};

  /**
   * The undo state.
   * 
   * If `false`, no undo is possible; otherwise, it is an object with the list
   * of properties to undo, when requested.
   * 
   * @type {false|{ [fieldName: string]: any}}
   * @memberof FormState
   */
  @observable undo = false;

  constructor() {
    /**
     * The initial settings of the observables.
     * 
     * @type {{ [fieldName: string]: any}}
     */
    this._orig = this.pull();
    /**
     * The list of error messages associated to each validate field.
     * @type { {[fieldName: string]: boolean|string;} }
     */
    this.errors = observable(_.mapValues(this.validators, () => false));
  }

  /**
   * Handle the change of an observable. 
   *
   * @param {React.SyntheticEvent} e The event that triggered the call
   * @param {Object} o The associated object: we read the `name`, 
   *   and the `value` or `checked` fields.
   * @memberof FormState
   * 
   * If the class has a method called `handle<name>`, this is called *before*
   * the rest of the code.
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
   *
   * @return {{ [fieldName: string]: any}} 
   * @memberof FormState
   */
  @action.bound pull() {
    return _.cloneDeep(_.pickBy(this, (v, k) => (k !== 'undo') && isObservableProp(this, k) && (!isComputedProp(this, k))));
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
   * 
   * @return {boolean} 
   * @memberof FormState
   */
  @action.bound validate() {
    _.assign(this.errors, _.mapValues(this.validators, (f, k) => f(this[k])));
    let cleanedErrors = _.pickBy(this.errors, (v) => v);
    _.forEach(cleanedErrors,
      (v, k) => when(() => !this.validators[k](this[k]), () => this.errors[k] = false));
    return _.isEmpty(cleanedErrors);
  }

  /**
   * Clear all errors.
   *
   * @memberof FormState
   */
  @action.bound clearErrors() {
    _.assign(this.errors, _.mapValues(this.validators, () => false));
  }

  /**
   * Perform a reset or an undo of the observables.
   *
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

  props(name) {
    const value = _.get(this, name);
    const error = _.get(this.errors, name);
    const onChange = this.handleChange;
    return { name, value, error, onChange };
  }
}


