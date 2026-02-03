'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import {
    registerCredentials,
    verifyForCheckout,
    cleanupAuthData,
    getAuthMethod,
    getAuthMethodLabel,
    type AuthMethod,
} from '@/lib/client/auth-client';

// Icons for visual feedback
const PasskeyIcon = () => (
    <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 1C8.14 1 5 4.14 5 8c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2h1a1 1 0 0 0 1-1v-3.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm0 2c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
    </svg>
);

const SoftwareKeyIcon = () => (
    <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
);

type MessageType = {
    type: 'success' | 'error' | 'info';
    text: string;
    anonymousId?: string;
    checkInId?: string;
    authMethod?: AuthMethod;
};

export default function CheckInForm() {
    const [anonymousId, setAnonymousId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [message, setMessage] = useState<MessageType | null>(null);
    const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
    const [showAuthChoice, setShowAuthChoice] = useState(false);
    const [pendingCheckIn, setPendingCheckIn] = useState<{ checkInId: string; anonymousId: string } | null>(null);

    // Check localStorage on mount to see if user is already checked in
    useEffect(() => {
        const checkInId = localStorage.getItem('checkInId');
        const storedAnonymousId = localStorage.getItem('anonymousId');
        
        if (checkInId && storedAnonymousId) {
            setIsCheckedIn(true);
            setAnonymousId(storedAnonymousId);
            setAuthMethod(getAuthMethod(checkInId));
        }
    }, []);

    const completeCredentialRegistration = async (
        checkInId: string,
        anonId: string,
        forceMethod?: AuthMethod
    ) => {
        const regResult = await registerCredentials(checkInId, anonId, forceMethod);
        
        if (regResult.success) {
            setAuthMethod(regResult.method || null);
            setMessage({
                type: 'success',
                text: '',
                anonymousId: anonId,
                checkInId: checkInId,
                authMethod: regResult.method,
            });
            setShowAuthChoice(false);
            setPendingCheckIn(null);
        } else if (regResult.showChoiceDialog) {
            // Show choice dialog instead of auto-falling back
            setPendingCheckIn({ checkInId, anonymousId: anonId });
            setShowAuthChoice(true);
            setMessage({
                type: 'info',
                text: 'WebAuthn registration was cancelled. Would you like to try again or use a software key?',
            });
        } else {
            setMessage({
                type: 'error',
                text: regResult.error || 'Failed to register credentials',
            });
        }
    };

    const handleCheckIn = async () => {
        setLoading(true);
        setMessage(null);
        setShowAuthChoice(false);

        try {
            const id = anonymousId || uuidv4();
            
            const response = await fetch('/api/checkin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    anonymousId: id,
                    deviceInfo: navigator.userAgent,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('checkInId', data.id);
                localStorage.setItem('anonymousId', data.anonymousId);
                setAnonymousId(data.anonymousId);
                setIsCheckedIn(true);

                // Now register credentials (WebAuthn or software key)
                await completeCredentialRegistration(data.id, data.anonymousId);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to check in' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleRetryWebAuthn = async () => {
        if (!pendingCheckIn) return;
        setLoading(true);
        setMessage(null);
        
        try {
            await completeCredentialRegistration(
                pendingCheckIn.checkInId,
                pendingCheckIn.anonymousId
            );
        } finally {
            setLoading(false);
        }
    };

    const handleUseSoftwareKey = async () => {
        if (!pendingCheckIn) return;
        setLoading(true);
        setMessage(null);
        
        try {
            await completeCredentialRegistration(
                pendingCheckIn.checkInId,
                pendingCheckIn.anonymousId,
                'software'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        const checkInId = localStorage.getItem('checkInId');
        
        if (!checkInId) {
            setMessage({ type: 'error', text: 'No active check-in found' });
            return;
        }

        if (!anonymousId) {
            setMessage({ type: 'error', text: 'Anonymous ID is required for checkout' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            // First, verify identity
            setMessage({ type: 'info', text: 'Verifying your identity...' });
            
            const verifyResult = await verifyForCheckout(checkInId);
            
            if (!verifyResult.success) {
                setMessage({ 
                    type: 'error', 
                    text: verifyResult.error || 'Identity verification failed. Cannot check out.' 
                });
                setLoading(false);
                return;
            }

            // Verification successful, proceed with checkout
            const response = await fetch(`/api/checkin/${checkInId}/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    anonymousId: anonymousId,
                    verified: true,
                }),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Checked out successfully!' });
                cleanupAuthData(checkInId);
                localStorage.removeItem('checkInId');
                localStorage.removeItem('anonymousId');
                setAnonymousId('');
                setIsCheckedIn(false);
                setAuthMethod(null);
            } else {
                const data = await response.json();
                setMessage({ type: 'error', text: data.error || 'Failed to check out' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Check-In System</h2>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="anonymousId" className="block text-sm font-medium text-gray-700 mb-2">
                        Anonymous ID {isCheckedIn ? '(Currently Checked In)' : '(optional - auto-generated if empty)'}
                    </label>
                    <input
                        id="anonymousId"
                        type="text"
                        value={anonymousId}
                        onChange={(e) => setAnonymousId(e.target.value)}
                        placeholder={isCheckedIn ? "Your current Anonymous ID" : "Leave empty for auto-generation"}
                        maxLength={100}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-800 ${
                            isCheckedIn ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                        disabled={loading || isCheckedIn}
                        readOnly={isCheckedIn}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {isCheckedIn 
                            ? 'This is your active Anonymous ID. Check out to unlock.' 
                            : 'Max 100 characters'}
                    </p>
                </div>

                {/* Auth method indicator */}
                {isCheckedIn && authMethod && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                        {authMethod === 'webauthn' ? <PasskeyIcon /> : <SoftwareKeyIcon />}
                        <span>Secured with: {getAuthMethodLabel(authMethod)}</span>
                    </div>
                )}

                {/* Auth choice dialog */}
                {showAuthChoice && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm text-amber-800 mb-3">
                            Choose how you&apos;d like to secure your check-in:
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRetryWebAuthn}
                                disabled={loading}
                                className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 disabled:bg-gray-400 text-sm font-medium flex items-center justify-center"
                            >
                                <PasskeyIcon />
                                Retry Passkey
                            </button>
                            <button
                                onClick={handleUseSoftwareKey}
                                disabled={loading}
                                className="flex-1 bg-gray-600 text-white py-2 px-3 rounded-md hover:bg-gray-700 disabled:bg-gray-400 text-sm font-medium flex items-center justify-center"
                            >
                                <SoftwareKeyIcon />
                                Use Software Key
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleCheckIn}
                        disabled={loading || isCheckedIn}
                        className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {loading ? 'Processing...' : isCheckedIn ? 'Already Checked In' : 'Check In'}
                    </button>

                    <button
                        onClick={handleCheckOut}
                        disabled={loading || !isCheckedIn}
                        className="flex-1 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {loading ? 'Processing...' : 'Check Out'}
                    </button>
                </div>

                {message && (
                    <div
                        className={`p-4 rounded-md ${
                            message.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : message.type === 'info'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                    >
                        {message.type === 'success' && message.anonymousId && message.checkInId ? (
                            <div className="text-sm space-y-3">
                                <p className="font-semibold">Checked in successfully!</p>
                                <div className="font-mono">
                                    <p className="font-bold mb-2">SAVE THESE IDs:</p>
                                    <p>• Anonymous ID: <span className="font-bold">{message.anonymousId}</span></p>
                                    <p>• Check-In ID: <span className="font-bold">{message.checkInId}</span></p>
                                </div>
                                {message.authMethod && (
                                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-green-200">
                                        {message.authMethod === 'webauthn' ? <PasskeyIcon /> : <SoftwareKeyIcon />}
                                        <span>Secured with: {getAuthMethodLabel(message.authMethod)}</span>
                                    </div>
                                )}
                                <p className="text-md"><strong><u>You&apos;ll need the Check-In ID</u></strong> to delete your session from the list.</p>
                            </div>
                        ) : (
                            <p className="text-sm">{message.text}</p>
                        )}
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                        Your anonymous ID is stored locally on your device, other users can only see a partial part of it in the Dashboard.
                        {authMethod && (
                            <span className="block mt-1">
                                Your check-in is protected by {authMethod === 'webauthn' ? 'hardware security (passkey)' : 'a software security key'}.
                            </span>
                        )}
                    </p>
                </div>
                <div>  
                    <Link href="/dashboard" className="block text-center bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-900 transition-colors font-medium">View Dashboard</Link>
                </div>
            </div>
        </div>
    );
}