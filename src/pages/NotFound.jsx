import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center'
    }}>
      <span style={{
        width: 56, height: 56, borderRadius: 16, background: 'var(--primary-dim)', color: 'var(--primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}><Compass size={26} /></span>
      <h1 style={{ fontSize: 26 }}>Lost your route?</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 340 }}>The page you're looking for doesn't exist on this journey.</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Home</button>
    </div>
  )
}
