import * as React from 'react';

import { IOwner, IEditablePet, IRouterProps, ISelectOption } from '../../types';

import { url } from '../../util';
import withRouter from '../../withRouter';

import LoadingPanel from './LoadingPanel';
import PetEditor from './PetEditor';

import createPetEditorModel from './createPetEditorModel';

interface IEditPetPageProps extends IRouterProps {
}

interface IEditPetPageState {
  pet?: IEditablePet;
  owner?: IOwner;
  pettypes?: ISelectOption[];
};

class EditPetPage extends React.Component<IEditPetPageProps, IEditPetPageState> {

  componentDidMount() {
    const { params } = this.props;

    const fetchUrl = url(`/api/owners/${params.ownerId}/pets/${params.petId}`);

    const loadPetPromise = fetch(fetchUrl).then(response => response.json());

    createPetEditorModel(this.props.params.ownerId, loadPetPromise)
      .then(model => this.setState(model));
  }

  render() {
    if (!this.state) {
      return <LoadingPanel />;
    }

    return <PetEditor {...this.state} />;
  }
}

export default withRouter(EditPetPage);
