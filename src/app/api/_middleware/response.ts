import { NextResponse } from 'next/server';

export function createApiResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
