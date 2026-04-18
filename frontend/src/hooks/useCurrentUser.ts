import { useEffect, useState } from 'react';
import { getCurrentUsername } from '../api/client';

export function useCurrentUser(): string | null {
  const [username, setUsername] = useState<string | null>(() => getCurrentUsername());
  useEffect(() => {
    const onStorage = () => setUsername(getCurrentUsername());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return username;
}
