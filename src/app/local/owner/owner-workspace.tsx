'use client';

import { useState } from 'react';
import { LocalOwnerConsole } from '../../../features/owner/local-owner-console';
import { createHttpOwnerApi } from '../../../features/owner/http-owner-api';

export function OwnerWorkspace({ userId }: { userId: string }) {
  const [api] = useState(() => createHttpOwnerApi({ expectedUserId: userId }));
  return <LocalOwnerConsole key={userId} api={api} userId={userId} />;
}
