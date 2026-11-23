import { Location, NavigateFunction } from 'react-router';

// ------------------------------------ ROUTER ------------------------------------
export interface IRouterProps {
  params: Readonly<Record<string, string | undefined>>;
  location: Location;
  navigate: NavigateFunction;
};

// ------------------------------------ UTIL --------------------------------------
export type IHttpMethod = 'POST' | 'PUT' | 'GET';


// ------------------------------------ ERROR ------------------------------------
export interface IFieldError {
  field: string;
  message: string;
}

interface IFieldErrors {
  [index: string]: IFieldError;
};

export interface IError {
  fieldErrors: IFieldErrors;
}


// ------------------------------------ FORM --------------------------------------
export interface IConstraint {
  message: string;
  validate: (value: any) => boolean;
}

export type IInputChangeHandler = (name: string, value: string, error: IFieldError) => void;

export interface ISelectOption {
  value: string|number;
  name: string;
};

// ------------------------------------ MODEL .------------------------------------

interface IBaseEntity {
  id: number;
  isNew: boolean;
};

interface INamedEntity extends IBaseEntity {
  name: string;
}

interface IPerson extends IBaseEntity {
  firstName: string;
  lastName: string;
}

export interface IVisit extends IBaseEntity {
  date: string;
  description: string;
};

export interface IPetType extends INamedEntity {
};

export type IPetTypeId = number;

export interface IPet extends INamedEntity {
  birthDate: string;
  type: IPetType;
  visits: IVisit[];
};

// TODO
export interface IEditablePet extends INamedEntity {
  birthDate?: string;
  typeId?: IPetTypeId;
}

export interface IPetRequest {
  name: string;
  birthDate?: string;
  type: IPetType;
}

export interface IOwner extends IPerson {

  address: string;
  city: string;
  telephone: string;
  pets: IPet[];
};

export interface ISpecialty extends INamedEntity {
};

export interface IVet extends IPerson {
  specialties: ISpecialty[];
};
