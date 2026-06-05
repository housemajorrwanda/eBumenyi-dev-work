import { StreamClient } from '@stream-io/node-sdk';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const API_SECRET = process.env.STREAM_SECRET_KEY;

const allowedOrigins = ['http://localhost:4173', 'https://www.ebumenyi.online'];

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : '',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function generateMeetingId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 9; i++) {
    if (i > 0 && i % 3 === 0) id += '-';
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function OPTIONS(request: NextRequest) {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { startsAt, hostEmail, description, meetingId: providedMeetingId } = body;

    // Validate required fields
    if (!startsAt) {
      return NextResponse.json(
        { error: 'startsAt is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (!hostEmail) {
      return NextResponse.json(
        { error: 'hostEmail is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Validate startsAt is a valid ISO string
    const startDate = new Date(startsAt);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'startsAt must be a valid ISO date string' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // For now, use hostEmail as userId. In production, you'd verify the email against your staff database
    // This prevents unauthorized users from scheduling meetings as others
    const userId = hostEmail.split('@')[0]; // Use email prefix as user ID
    // TODO: Add verification that this user is a valid staff member from your backend API

    // Validate API credentials
    if (!API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // Initialize Stream client
    const client = new StreamClient(API_KEY, API_SECRET);
    
    let meetingId;
    let call;
    if (providedMeetingId) {
      call = client.video.call('default', providedMeetingId);
      const callData = await call.get().catch(() => null);
      if (callData && (callData.call.custom as any).host_id === userId) {
        // Update the call
        await call.update({
          starts_at: startDate.toISOString(),
          custom: {
            description,
            host_id: userId,
          },
        });
        meetingId = providedMeetingId;
      } else {
        // Meeting does not exist or unauthorized, generate new
        meetingId = generateMeetingId();
        call = client.video.call('default', meetingId);
        await call.getOrCreate({
          data: {
            starts_at: startDate.toISOString(),
            custom: {
              description,
              host_id: userId,
            },
            created_by_id: userId,
          },
        });
      }
    } else {
      // Create new meeting
      meetingId = generateMeetingId();
      call = client.video.call('default', meetingId);
      await call.getOrCreate({
        data: {
          starts_at: startDate.toISOString(),
          custom: {
            description,
            host_id: userId,
          },
          created_by_id: userId,
        },
      });
    }    // Generate meeting link
    const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meetingId}`;

    return NextResponse.json(
      {
        success: true,
        meetingId,
        meetingLink,
        startsAt: startDate.toISOString(),
        hostEmail,
        description,
      },
      { status: 201, headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    return NextResponse.json(
      { error: 'Failed to schedule meeting', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { meetingId, hostEmail } = body;

    // Validate required fields
    if (!meetingId) {
      return NextResponse.json(
        { error: 'meetingId is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (!hostEmail) {
      return NextResponse.json(
        { error: 'hostEmail is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Look up user by email
    const userId = hostEmail.split('@')[0]; // Use email prefix as user ID
    // TODO: Add verification that this user is a valid staff member from your backend API

    // Validate API credentials
    if (!API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // Initialize Stream client
    const client = new StreamClient(API_KEY, API_SECRET);

    // Get the call
    const call = client.video.call('default', meetingId);
    const callData = await call.get();

    // Check if the host matches
    if ((callData.call.custom as any).host_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this meeting' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    // Delete the call
    // @ts-ignore
    await call.delete();

    return NextResponse.json(
      { success: true, message: 'Meeting deleted successfully' },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json(
      { error: 'Failed to delete meeting', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
