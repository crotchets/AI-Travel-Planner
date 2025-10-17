"use client"
import AuthForm from '../../components/AuthForm'

export default function AuthPage() {
    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">登录或注册</h2>
            <AuthForm />
        </div>
    )
}
