import * as React from 'react';
import { Route } from 'react-router';

import App from './components/App';

import WelcomePage from './components/WelcomePage';
import FindOwnersPage from './components/owners/FindOwnersPage';
import OwnersPage from './components/owners/OwnersPage';
import NewOwnerPage from './components/owners/NewOwnerPage';
import EditOwnerPage from './components/owners/EditOwnerPage';
import NewPetPage from './components/pets/NewPetPage';
import EditPetPage from './components/pets/EditPetPage';
import VisitsPage from './components/visits/VisitsPage';
import VetsPage from './components/vets/VetsPage';
import ErrorPage from './components/ErrorPage';
import LoginPage from './components/LoginPage';


import NotFoundPage from './components/NotFoundPage';



export default () => (
  <Route element={<App />}>
    <Route path='/' element={<WelcomePage />} />
    <Route path='/owners/list' element={<FindOwnersPage />} />
    <Route path='/owners/new' element={<NewOwnerPage />} />
    <Route path='/owners/:ownerId/edit' element={<EditOwnerPage />} />
    <Route path='/owners/:ownerId/pets/:petId/edit' element={<EditPetPage />} />
    <Route path='/owners/:ownerId/pets/new' element={<NewPetPage />} />
    <Route path='/owners/:ownerId/pets/:petId/visits/new' element={<VisitsPage />} />
    <Route path='/owners/:ownerId' element={<OwnersPage />} />
    <Route path='/vets' element={<VetsPage />} />
    <Route path='/error' element={<ErrorPage />} />
    <Route path='/login' element={<LoginPage />} />
    <Route path='*' element={<NotFoundPage />} />
  </Route>
);

