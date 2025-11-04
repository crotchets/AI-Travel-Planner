"use client"
import AuthForm from '../../components/AuthForm'

export default function AuthPage() {
    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
            <h2 className="mb-6 text-2xl font-bold">登录或注册</h2>
            <AuthForm />
        </div>
    )
}
