import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  help?: string;
}

export function createApiResponse<T>(data: T, statusCode: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data
  }, { status: statusCode });
}

export function createErrorResponse(message: string, statusCode: number = 400, help?: string): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
    ...(help && { help })
  }, { status: statusCode });
}
