import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Cookie carrier: signInWithPassword's setAll writes here; the actual
    // JSON body is decided after we know the result, then copied on top.
    const cookieCarrier = new NextResponse()

    // Use the same getAll/setAll cookie adapter middleware.ts reads with,
    // so signInWithPassword's session is persisted in the exact format
    // @supabase/ssr expects to read back (JSON, chunked if needed).
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieCarrier.cookies.set(name, value, options)
          }
        },
      },
    })

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.session) {
      return NextResponse.json({ error: 'No session created' }, { status: 400 })
    }

    return NextResponse.json(
      { user: data.user, message: 'Login successful' },
      { headers: cookieCarrier.headers }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 }
    )
  }
}