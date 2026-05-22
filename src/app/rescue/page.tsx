'use client'

import { signIn } from "next-auth/react"
import { useState } from "react"

export default function RescuePage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [status, setStatus] = useState('')

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setStatus('Logging in...')
        const res = await signIn('credentials', {
            email,
            password,
            redirect: false
        })
        if (res?.error) {
            setStatus('Error: ' + res.error)
        } else {
            setStatus('Success! Redirecting...')
            window.location.href = '/'
        }
    }

    return (
        <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
            <h1>RESCUE LOGIN</h1>
            <p>If the main login page is stuck, use this simple form.</p>
            <form onSubmit={handleSubmit}>
                <input 
                    type="email" 
                    placeholder="Email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
                />
                <button type="submit" style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none' }}>
                    Login
                </button>
            </form>
            <p>{status}</p>
            <hr />
            <h3>System Status</h3>
            <p>Detected IP: {typeof window !== 'undefined' ? window.location.host : 'Loading...'}</p>
        </div>
    )
}
