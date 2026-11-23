import * as React from 'react';

import { IOwner, IRouterProps } from '../../types';
import { url } from '../../util';
import withRouter from '../../withRouter';

import OwnerInformation from './OwnerInformation';
import PetsTable from './PetsTable';

interface IOwnersPageProps extends IRouterProps {
}

interface IOwnerPageState {
  owner?: IOwner;
}

class OwnersPage extends React.Component<IOwnersPageProps, IOwnerPageState> {

  constructor(props) {
    super(props);

    this.state = {};
  }

  componentDidMount() {
    const { params } = this.props;

    if (params && params.ownerId) {
      const fetchUrl = url(`/api/owners/${params.ownerId}`);
      fetch(fetchUrl)
        .then(response => response.json())
        .then(owner => this.setState({ owner }));
    }
  }

  render() {
    const { owner } = this.state;

    if (!owner) {
      return <h2>No Owner loaded</h2>;
    }

    return (
      <span>
        <OwnerInformation owner={owner} />
        <PetsTable owner={owner} />
      </span>
    );
  }
}

export default withRouter(OwnersPage);
