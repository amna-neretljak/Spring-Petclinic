import * as React from 'react';

import { url, submitForm } from '../util';
import { saveCredentials } from '../util/authStorage';
import withRouter from '../withRouter';

import Input from './form/Input';
import { NotEmpty } from './form/Constraints';

import { IError, IFieldError, IRouterProps } from '../types';

interface ICredentials {
  username: string;
  password: string;
}

interface ILoginPageState {
  credentials: ICredentials;
  error?: IError;
  loginError?: string;
}

class LoginPage extends React.Component<IRouterProps, ILoginPageState> {

  constructor(props) {
    super(props);
    this.onInputChange = this.onInputChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    this.state = {
      credentials: {
        username: '',
        password: ''
      }
    };
  }

  onSubmit(event) {
    event.preventDefault();

    const { credentials } = this.state;

    submitForm('POST', '/api/login', { username: credentials.username, password: credentials.password }, (status) => {
      if (status >= 200 && status < 300) {
        saveCredentials(credentials.username, credentials.password);
        this.props.navigate('/');
      } else {
        this.setState({ loginError: 'Invalid username or password' });
      }
    });
  }

  onInputChange(name: string, value: string, fieldError: IFieldError) {
    const { credentials, error } = this.state;
    const modifiedCredentials = Object.assign({}, credentials, { [name]: value });
    const newFieldErrors = error ? Object.assign({}, error.fieldErrors, { [name]: fieldError }) : { [name]: fieldError };
    this.setState({
      credentials: modifiedCredentials,
      error: { fieldErrors: newFieldErrors },
      loginError: undefined
    });
  }

  render() {
    const { credentials, error, loginError } = this.state;
    return (
      <span>
        <h2>Login</h2>
        {loginError && <div className='alert alert-danger'>{loginError}</div>}
        <form className='form-horizontal' method='POST' action={url('/api/login')}>
          <div className='form-group has-feedback'>
            <Input object={credentials} error={error} constraint={NotEmpty} label='Username' name='username' onChange={this.onInputChange} />
            <Input object={credentials} error={error} constraint={NotEmpty} label='Password' name='password' type='password' onChange={this.onInputChange} />
          </div>
          <div className='form-group'>
            <div className='col-sm-offset-2 col-sm-10'>
              <button className='btn btn-default' type='submit' onClick={this.onSubmit}>Login</button>
            </div>
          </div>
        </form>
      </span>
    );
  }
}

export default withRouter(LoginPage);
