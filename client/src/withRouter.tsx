import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { IRouterProps } from './types';

/**
 * Passes the router's params, location and navigate function to class components,
 * which cannot use the router hooks themselves.
 */
export default function withRouter<P extends IRouterProps>(Component: React.ComponentType<P>) {
  return (props: Omit<P, keyof IRouterProps>) => {
    const routerProps: IRouterProps = {
      params: useParams(),
      location: useLocation(),
      navigate: useNavigate()
    };
    return <Component {...(props as P)} {...routerProps} />;
  };
}
