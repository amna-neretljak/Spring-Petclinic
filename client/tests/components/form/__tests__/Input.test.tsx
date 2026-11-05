import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';

import { IConstraint } from '../../../../src/types';

import Input from '../../../../src/components/form/Input';

describe('Input', () => {

  const onChange = (name, value, error) => {
    onChangeResult = { name, value, error };
  };

  let object = null;
  let onChangeResult = null;

  beforeEach(() => {
    object = {
      myField: 'blabla'
    };

    onChangeResult = null;
  });

  it('should render correctly without field error', () => {
    const error = {
      fieldErrors: {}
    };

    const { container } = render(<Input object={object}
      label='My Field'
      name='myField'
      error={error}
      onChange={onChange}
      />);

    // Make sure label is rendered correctly
    expect(container.querySelector('.control-label').textContent).toBe('My Field');

    // Make sure input field's value is correct
    const input = container.querySelector('input');
    expect(input.value).toBe('blabla');

    // we don't have any errors
    expect(container.querySelectorAll('.has-error').length).toBe(0);
    expect(container.querySelector('.glyphicon-ok')).not.toBeNull();

    // change to new value
    fireEvent.change(input, { target: { value: 'My new value' } });

    // make sure callback is called
    expect(onChangeResult).toBeTruthy();
    expect(onChangeResult.name).toBe('myField');
    expect(onChangeResult.value).toBe('My new value');
    expect(onChangeResult.error).toBeFalsy();
  });

  it('should render correctly with field error', () => {

    const error = {
      fieldErrors: {
        myField: {
          field: 'myField',
          message: 'There was an error'
        }
      }
    };

    const { container } = render(<Input object={object}
      label='My Field'
      name='myField'
      error={error}
      onChange={onChange}
      />);

    // Make sure label is rendered correctly
    expect(container.querySelector('.control-label').textContent).toBe('My Field');

    // Make sure input field's value is correct
    expect(container.querySelector('input').value).toBe('blabla');

    // the field error is shown
    expect(container.querySelectorAll('.has-error').length).toBe(1);
    expect(container.querySelector('.glyphicon-ok')).toBeNull();
    expect(container.querySelector('.help-inline').textContent).toBe('There was an error');
  });

  it('should checked constrains on input change', () => {

    const error = {
      fieldErrors: {}
    };

    const constraint: IConstraint = {
      message: 'Invalid',
      validate: jest.fn()
    };

    const { container } = render(<Input object={object}
      label='My Field'
      name='myField'
      error={error}
      onChange={onChange}
      constraint={constraint}
      />);

    fireEvent.change(container.querySelector('input'), { target: { value: 'My new value' } });
    expect(constraint.validate).toHaveBeenCalledWith('My new value');
  });
});
