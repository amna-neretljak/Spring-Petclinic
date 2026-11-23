import * as React from 'react';
import OwnerEditor from './OwnerEditor';

import { IOwner, IRouterProps } from '../../types';
import { url, apiFetch } from '../../util';
import withRouter from '../../withRouter';

interface IEditOwnerPageProps extends IRouterProps {
}

interface IEditOwnerPageState {
  owner: IOwner;
}

class EditOwnerPage extends React.Component<IEditOwnerPageProps, IEditOwnerPageState> {
  componentDidMount() {
    const { params } = this.props;

    if (params && params.ownerId) {
      const fetchUrl = url(`/api/owners/${params.ownerId}`);
      apiFetch(fetchUrl)
        .then(response => response.json())
        .then(owner => this.setState({ owner }));
    }
  }
  render() {
    const owner = this.state && this.state.owner;
    if (owner) {
      return <OwnerEditor initialOwner={owner} />;
    }
    return null;
  }
}

export default withRouter(EditOwnerPage);
