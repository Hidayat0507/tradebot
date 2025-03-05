import { NextResponse } from 'next/server';
import { ExchangeError } from './exchange';

export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof ExchangeError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // Handle other types of errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}
