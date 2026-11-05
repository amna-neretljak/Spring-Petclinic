import * as React from 'react';
import { BrowserRouter, Routes } from 'react-router';

// Routes
import configureRoutes from './configureRoutes';

const Root = () => (
  <BrowserRouter>
    <Routes>
      {configureRoutes()}
    </Routes>
  </BrowserRouter>
);

export default Root;
