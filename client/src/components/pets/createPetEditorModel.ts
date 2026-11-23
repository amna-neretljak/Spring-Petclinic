import { IEditablePet, IPet, IPetType, ISelectOption } from '../../types';
import { url, apiFetch } from '../../util';

const toSelectOptions = (pettypes: IPetType[]): ISelectOption[] => pettypes.map(pettype => ({ value: pettype.id, name: pettype.name }));

const toEditablePet = (pet: IEditablePet | IPet): IEditablePet => {
  const typeId = (pet as IEditablePet).typeId != null
    ? (pet as IEditablePet).typeId
    : (pet as IPet).type && (pet as IPet).type.id;
  return {
    id: pet.id,
    isNew: !!pet.isNew,
    name: pet.name,
    birthDate: pet.birthDate,
    typeId
  };
};

export default (ownerId: string, petLoaderPromise: Promise<any>): Promise<any> => {
  return Promise.all(
    [apiFetch(url('/api/pettypes'))
      .then(response => response.json())
      .then(toSelectOptions),
    apiFetch(url('/api/owners/' + ownerId))
      .then(response => response.json()),
      petLoaderPromise,
    ]
  ).then(results => ({
    pettypes: results[0],
    owner: results[1],
    pet: toEditablePet(results[2])
  }));
};
