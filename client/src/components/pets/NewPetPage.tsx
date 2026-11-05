import * as React from 'react';

import { IOwner, IEditablePet, IRouterProps, ISelectOption } from '../../types';

import withRouter from '../../withRouter';

import LoadingPanel from './LoadingPanel';
import PetEditor from './PetEditor';

import createPetEditorModel from './createPetEditorModel';

interface INewPetPageProps extends IRouterProps {
}

interface INewPetPageState {
  pet?: IEditablePet;
  owner?: IOwner;
  pettypes?: ISelectOption[];
};

const NEW_PET: IEditablePet = {
  id: null,
  isNew: true,
  name: '',
  birthDate: null,
  typeId: null
};

class NewPetPage extends React.Component<INewPetPageProps, INewPetPageState> {

  componentDidMount() {
    createPetEditorModel(this.props.params.ownerId, Promise.resolve(NEW_PET))
      .then(model => this.setState(model));
  }

  render() {
    if (!this.state) {
      return <LoadingPanel />;
    }

    return <PetEditor {...this.state} />;
  }
}

export default withRouter(NewPetPage);