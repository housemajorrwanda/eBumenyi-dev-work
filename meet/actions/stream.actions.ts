'use server';

import { StreamClient } from '@stream-io/node-sdk';
import { cookies } from 'next/headers';

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

// Token provider for authenticated staff users
export const tokenProvider = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) throw new Error('User is not authenticated');
  if (!STREAM_API_KEY) throw new Error('Stream API key secret is missing');
  if (!STREAM_API_SECRET) throw new Error('Stream API secret is missing');

  // For now, use a simple token parsing. In production, verify with your backend API
  // Extract userId from token (assuming it's a JWT with userId claim)
  let userId: string;
  try {
    // Basic JWT parsing (just decode, don't verify signature server-side for now)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    userId = payload.userId || payload.sub || payload.id;
    
    if (!userId) throw new Error('No userId found in token');
  } catch (error) {
    throw new Error('Invalid authentication token');
  }

  const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);

  const expirationTime = Math.floor(Date.now() / 1000) + 3600;
  const issuedAt = Math.floor(Date.now() / 1000) - 60;

  const tokenString = streamClient.createToken(userId, expirationTime, issuedAt);

  return tokenString;
};

// Token provider for guest users (no authentication required)
export const guestTokenProvider = async (guestId: string) => {
  if (!STREAM_API_KEY) throw new Error('Stream API key secret is missing');
  if (!STREAM_API_SECRET) throw new Error('Stream API secret is missing');

  const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);

  const expirationTime = Math.floor(Date.now() / 1000) + 3600;
  const issuedAt = Math.floor(Date.now() / 1000) - 60;

  const token = streamClient.createToken(guestId, expirationTime, issuedAt);

  return token;
};
