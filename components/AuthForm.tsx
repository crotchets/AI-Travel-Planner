"use client"
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function AuthForm() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const router = useRouter()
    const searchParams = useSearchParams()
    const next = searchParams?.get('next') ?? '/dashboard'

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        if (isSignUp) {
            const { data, error } = await supabase.auth.signUp({ email, password })
            if (error) setMessage(error.message)
            else setMessage('注册成功，请检查邮箱完成验证（如果已启用）。')
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setMessage(error.message)
            else {
                setMessage('登录成功')
                // redirect after successful login
                try {
                    router.replace(next)
                } catch (e) {
                    // ignore
                }
            }
        }

        setLoading(false)
    }

    return (
        <div className="max-w-md w-full p-6 bg-white rounded shadow">
            <h3 className="text-xl font-semibold mb-4">{isSignUp ? '注册' : '登录'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">邮箱</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full border rounded px-3 py-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium">密码</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full border rounded px-3 py-2" />
                </div>
                <div className="flex items-center justify-between">
                    <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
                        {loading ? '处理中…' : isSignUp ? '注册' : '登录'}
                    </button>
                    <button type="button" onClick={() => setIsSignUp(v => !v)} className="text-sm text-gray-600 underline">
                        {isSignUp ? '已有账号？登录' : '没有账号？注册'}
                    </button>
                </div>
            </form>
            {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        </div>
    )
}
