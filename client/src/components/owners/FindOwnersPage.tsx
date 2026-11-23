import * as React from 'react';

import { Link } from 'react-router';
import { IOwner, IRouterProps } from '../../types';
import { url, apiFetch } from '../../util';
import withRouter from '../../withRouter';

import OwnersTable from './OwnersTable';


interface IFindOwnersPageProps extends IRouterProps {
}

interface IFindOwnersPageState {
  owners?: IOwner[];
  filter?: string;
}

const getFilterFromLocation = (location: IRouterProps['location']) => {
  return new URLSearchParams(location.search).get('lastName');
};

class FindOwnersPage extends React.Component<IFindOwnersPageProps, IFindOwnersPageState> {
  constructor(props) {
    super(props);
    this.onFilterChange = this.onFilterChange.bind(this);
    this.submitSearchForm = this.submitSearchForm.bind(this);

    this.state = {
      filter: getFilterFromLocation(props.location)
    };
  }

  componentDidMount() {
    // without a lastName query param this lists all owners
    this.fetchData(this.state.filter);
  }

  componentDidUpdate(prevProps: IFindOwnersPageProps) {
    const { location } = this.props;
    if (location === prevProps.location) {
      return;
    }

    // read the filter from uri
    const filter = getFilterFromLocation(location);

    // set state
    this.setState({ filter });

    // load data according to filter
    this.fetchData(filter);
  }

  onFilterChange(event) {
    this.setState({
      filter: event.target.value as string
    });
  }

  /**
   * Invoked when the submit button was pressed.
   * 
   * This method updates the URL with the entered lastName. The change of the URL
   * leads to new properties and thus results in rerending
   */
  submitSearchForm() {
    const { filter } = this.state;

    this.props.navigate({
      pathname: '/owners/list',
      search: '?' + new URLSearchParams({ lastName: filter || '' })
    });
  }

  /** 
   * Actually loads data from the server
   */
  fetchData(filter: string) {
    const query = filter ? encodeURIComponent(filter) : '';
    const requestUrl = url('api/owners?lastName=' + query);

    // the backend answers 404 with an empty body when no owner matches
    apiFetch(requestUrl)
      .then(response => response.status === 404 ? [] : response.json())
      .then(owners => { this.setState({ owners }); });
  }

  render() {
    const { filter, owners } = this.state;

    return (
      <span>
        <section>
          <h2>Find Owners</h2>

          <form className='form-horizontal' action='javascript:void(0)'>
            <div className='form-group'>
              <div className='control-group' id='lastName'>
                <label className='col-sm-2 control-label'>Last name </label>
                <div className='col-sm-10'>
                  <input className='form-control' name='filter' value={filter || ''} onChange={this.onFilterChange} size={30} maxLength={80} />
                  { /* <span className='help-inline'><form:errors path='*'/></span> TODO */}
                </div>
              </div>
            </div>
            <div className='form-group'>
              <div className='col-sm-offset-2 col-sm-10'>
                <button type='button' onClick={this.submitSearchForm} className='btn btn-default'>Find Owner</button>
              </div>
            </div>
          </form>
        </section>
        <OwnersTable owners={owners} />
        <Link className='btn btn-default' to='/owners/new'> Add Owner</Link>
      </span>
    );
  }
};

export default withRouter(FindOwnersPage);
