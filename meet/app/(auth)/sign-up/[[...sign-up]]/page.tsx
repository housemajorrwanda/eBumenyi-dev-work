'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login - no sign-ups allowed, staff only
    router.replace('/sign-in');
  }, [router]);

  return null;
}
