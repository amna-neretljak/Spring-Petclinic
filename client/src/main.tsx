import * as React from 'react';
import { createRoot } from 'react-dom/client';

import './styles/less/petclinic.less';

// The Application
import Root from './Root';

// Render Application
createRoot(document.getElementById('mount')).render(<Root />);
