/**
 * AdminGuarded — composes RequireAuth + AdminPortal so the route table
 * (a plain .ts file with no JSX) can reference /admin via a single
 * Component import. Cleaner than inlining JSX into routes.ts.
 */

import { RequireAuth } from './RequireAuth';
import AdminPortal from '../pages/AdminPortal';

export default function AdminGuarded() {
  return (
    <RequireAuth>
      <AdminPortal />
    </RequireAuth>
  );
}
