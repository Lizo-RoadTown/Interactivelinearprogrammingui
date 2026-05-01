/**
 * NotFound — friendly fallback for any URL that doesn't match a route.
 *
 * Replaces the React Router default error page with something a real
 * user can act on: a list of where they probably meant to go.
 */

import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-card/40 border-2 border-border rounded-2xl p-6 space-y-4 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          404 — page not found
        </p>
        <p className="text-sm text-foreground/90">
          There&apos;s no page at <code className="font-mono bg-muted/40 border border-border rounded px-1.5 py-0.5">{loc.pathname}</code>.
        </p>
        <div className="bg-muted/20 border border-border rounded-lg p-3 text-left text-[12px] space-y-1.5">
          <p className="text-muted-foreground font-semibold mb-1">Where you probably meant to go:</p>
          <ul className="space-y-1">
            <li>
              <Link to="/" className="text-primary hover:text-primary/80 underline decoration-dotted">
                /
              </Link>
              {' '}— the main workspace (start here)
            </li>
            <li>
              <Link to="/admin" className="text-primary hover:text-primary/80 underline decoration-dotted">
                /admin
              </Link>
              {' '}— professor&apos;s workspace, manage your problem bank
            </li>
            <li>
              <Link to="/educator" className="text-primary hover:text-primary/80 underline decoration-dotted">
                /educator
              </Link>
              {' '}— team-project demo (three Python functions running live)
            </li>
            <li>
              <Link to="/learn/wp-toy-factory" className="text-primary hover:text-primary/80 underline decoration-dotted">
                /learn/wp-toy-factory
              </Link>
              {' '}— guided walkthrough
            </li>
            <li>
              <Link to="/matrix-method/ch8-example-1" className="text-primary hover:text-primary/80 underline decoration-dotted">
                /matrix-method/ch8-example-1
              </Link>
              {' '}— Chapter 8 matrix-method gameboard
            </li>
          </ul>
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <Link to="/">
            <Button variant="ghost"><ArrowLeft className="w-4 h-4 mr-1" /> Back home</Button>
          </Link>
          <Link to="/admin">
            <Button className="bg-primary hover:bg-primary/90 text-white"><Home className="w-4 h-4 mr-1" /> Go to admin</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
