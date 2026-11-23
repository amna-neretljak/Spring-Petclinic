import * as React from 'react';

import { url, apiFetch } from '../util';

interface IErrorPageState {
  error?: {
    status: string;
    message: string;
  };
}

export default class ErrorPage extends React.Component<{}, IErrorPageState> {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    apiFetch(url('api/oops'))
      .then(response => response.json().catch(() => ({})).then(body => ({ status: response.status, body })))
      .then(({ status, body }) => this.setState({
        error: {
          status: String(body.status ?? body.className ?? status),
          message: body.message || body.exMessage || 'Unknown error'
        }
      }))
      .catch(() => this.setState({
        error: { status: 'unknown', message: 'Could not reach the error endpoint' }
      }));
  }

  render() {
    const { error } = this.state;

    return <span>
      <img src='/images/pets.png' />

      <h2>Something happened...</h2>
      { error ?
        <span>
          <p><b>Status:</b> {error.status}</p>
          <p><b>Message:</b> {error.message}</p>
        </span>
        :
        <p><b>Unkown error</b></p>
      }
    </span>;
  }
};
