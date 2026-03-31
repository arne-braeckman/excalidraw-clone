import React, { useState } from 'react';
import { useStore } from '../store';
import { KeyRound, Mail, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';

export const LoginScreen: React.FC = () => {
   const [mode, setMode] = useState<'login' | 'register' | 'magic'>('login');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [name, setName] = useState('');
   const [error, setError] = useState('');
   const [magicSent, setMagicSent] = useState(false);
   
   const setCurrentUser = useStore(state => state.setCurrentUser);

   const handleAction = async (e: React.FormEvent) => {
       e.preventDefault();
       setError('');
       
       if (mode === 'register') {
           if (!name || !email || !password) return setError("All fields are required");
           const { data, error } = await supabase.auth.signUp({
               email,
               password,
               options: { data: { name } }
           });
           if (error) return setError(error.message);
           if (data.user) setCurrentUser(data.user.id);
       } 
       else if (mode === 'login') {
           if (!email || !password) return setError("All fields are required");
           const { data, error } = await supabase.auth.signInWithPassword({ email, password });
           if (error) return setError(error.message);
           if (data.user) setCurrentUser(data.user.id);
       }
       else if (mode === 'magic') {
           if (!email) return setError("Email is required");
           const { error } = await supabase.auth.signInWithOtp({ email });
           if (error) return setError(error.message);
           setMagicSent(true);
       }
   };

   return (
       <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
           <div style={{ width: '400px', padding: '40px', background: 'var(--panel-bg)', borderRadius: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.15)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', color: 'var(--accent-color)' }}>
                    {mode === 'login' && <KeyRound size={48} />}
                    {mode === 'register' && <UserPlus size={48} />}
                    {mode === 'magic' && <Mail size={48} />}
                </div>

                <h2 style={{margin: 0, marginBottom: '8px', fontSize: '28px', textAlign: 'center', fontWeight: 800}}>
                    {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Magic Link'}
                </h2>
                <p style={{fontSize: '15px', color: 'var(--text-muted)', marginBottom: '32px', marginTop: 0, textAlign: 'center', lineHeight: '1.4'}}>
                    Local-first decentralized authentication vault.
                </p>

                {error && <div style={{ background: 'rgba(255,0,0,0.1)', color: '#ff4d4f', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 600, textAlign: 'center' }}>{error}</div>}

                {magicSent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '24px', border: '2px dashed var(--accent-color)', borderRadius: '12px', background: 'rgba(0,122,255,0.05)' }}>
                        <span style={{textAlign: 'center', fontSize: '15px'}}>Secure magic link successfully generated for <b>{email}</b>!</span>
                        <span style={{textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)'}}>Please check your email. Click the secure link inside to automatically authenticate.</span>
                    </div>
                ) : (
                    <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {mode === 'register' && (
                            <input 
                                value={name} onChange={e => setName(e.target.value)} placeholder="Full Name (for Dashboard)"
                                style={{ background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', padding: '16px', borderRadius: '12px', fontSize: '15px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                            />
                        )}
                        
                        <input 
                            type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" autoFocus
                            style={{ background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', padding: '16px', borderRadius: '12px', fontSize: '15px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                        />
                        
                        {mode !== 'magic' && (
                            <input 
                                type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Secure Password"
                                style={{ background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', padding: '16px', borderRadius: '12px', fontSize: '15px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                            />
                        )}
                        
                        <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--text-main)', color: 'var(--bg-color)', padding: '16px', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px', transition: '0.2s' }}>
                            {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Sign Up' : 'Send Link'}
                        </button>
                    </form>
                )}

                {!magicSent && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '32px', fontSize: '14px' }}>
                        {mode !== 'login' && <button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Sign In</button>}
                        {mode !== 'register' && <button onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Create Account</button>}
                        {mode !== 'magic' && <button onClick={() => { setMode('magic'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Magic Link</button>}
                    </div>
                )}

           </div>
       </div>
   )
}
