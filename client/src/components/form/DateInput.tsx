import * as React from 'react';

import DatePicker from 'react-datepicker';

import { IError, IInputChangeHandler } from '../../types';

import FieldFeedbackPanel from './FieldFeedbackPanel';

// The backend exchanges dates as ISO strings (yyyy-MM-dd).
const toDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toDateString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default ({object, error, name, label, onChange}: { object: any, error: IError, name: string, label: string, onChange: IInputChangeHandler }) => {

  const handleOnChange = (value: Date | null) => {
    onChange(name, value ? toDateString(value) : null, null);
  };

  const selectedValue = object[name] ? toDate(object[name]) : null;
  const fieldError = error && error.fieldErrors[name];
  const valid = !fieldError && selectedValue != null;

  const cssGroup = `form-group ${fieldError ? 'has-error' : ''}`;

  return (
    <div className={cssGroup}>
      <label className='col-sm-2 control-label'>{label}</label>

      <div className='col-sm-10'>
        <DatePicker selected={selectedValue} onChange={handleOnChange} className='form-control' dateFormat='yyyy-MM-dd' />
        <span className='glyphicon glyphicon-ok form-control-feedback' aria-hidden='true'></span>
        <FieldFeedbackPanel valid={valid} fieldError={fieldError} />
      </div>
    </div>
  );
};
