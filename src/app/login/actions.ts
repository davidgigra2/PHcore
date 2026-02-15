'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const usernameInput = formData.get('username') as string
    const password = formData.get('password') as string

    // 1. Try to resolve username to email via RPC
    const { data: emailData, error: rpcError } = await supabase.rpc('get_email_by_username', {
        p_username: usernameInput
    })

    // Determine what email to use: the resolved one, or the input itself (if it was an email)
    const emailToUse = emailData || usernameInput

    const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
    })

    if (error) {
        console.error("Login Error:", error.message)
        return { error: 'Usuario o contraseña incorrectos' }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
