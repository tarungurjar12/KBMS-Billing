
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

export async function createClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error(
      "Supabase Middleware: NEXT_PUBLIC_SUPABASE_URL environment variable is not defined. " +
      "Ensure it's in your .env.local file and the server has been restarted."
    );
    throw new Error(
      "Supabase Middleware: NEXT_PUBLIC_SUPABASE_URL environment variable is not defined."
    );
  }
  if (!supabaseAnonKey) {
    console.error(
      "Supabase Middleware: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not defined. " +
      "Ensure it's in your .env.local file and the server has been restarted."
    );
    throw new Error(
      "Supabase Middleware: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not defined."
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          // The `request.cookies.set` method above only updates the cookies on the NextRequest object.
          // It does not actually set the cookie in the browser.
          // Therefore, we need to explicitly set the cookie on the NextResponse object as well.
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
           // The `request.cookies.set` method above only updates the cookies on the NextRequest object.
          // It does not actually set the cookie in the browser.
          // Therefore, we need to explicitly set the cookie on the NextResponse object as well.
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
}
