import { useEffect, useState } from 'react';
import App from './App';
import { Landing } from './components/Landing/Landing';

type Route = 'landing' | 'tutorial';

function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'tutorial' || hash === 'app') return 'tutorial';
  return 'landing';
}

/**
 * Top-level router. Keeps the interactive tutorial (App) fully intact and adds
 * a marketing landing page in front of it. Hash-based routing keeps this safe
 * for static hosting (GitHub Pages) with no server rewrites required.
 */
export function Root() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.body.dataset.route = route;
    return () => { delete document.body.dataset.route; };
  }, [route]);

  if (route === 'tutorial') {
    return <App />;
  }
  return <Landing />;
}
