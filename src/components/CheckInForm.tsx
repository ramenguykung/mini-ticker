'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import {
    registerCredentials,
    verifyForCheckout,
    purgeAllCredentials,
    getUserProfile,
    checkStoredCredentials,
    getAuthMethodLabel,
    type AuthMethod,
} from '@/lib/client/auth-client';

// Icons
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
    
    // Dialog states
    const [showAuthChoice, setShowAuthChoice] = useState(false);
    const [showExistingCredChoice, setShowExistingCredChoice] = useState(false);
    const [showStartFreshConfirm, setShowStartFreshConfirm] = useState(false);
    const [existingCredInfo, setExistingCredInfo] = useState<{ method: AuthMethod } | null>(null);
    
    // Pending check-in ID for auth choice flow
    const [pendingAnonymousId, setPendingAnonymousId] = useState<string | null>(null);

    // Check localStorage and user profile on mount
    useEffect(() => {
        const checkInId = localStorage.getItem('checkInId');
        const storedAnonymousId = localStorage.getItem('anonymousId');
        
        if (checkInId && storedAnonymousId) {
            setIsCheckedIn(true);
            setAnonymousId(storedAnonymousId);
            
            // Get auth method from profile
            const profile = getUserProfile();
            if (profile && profile.anonymousId === storedAnonymousId) {
                setAuthMethod(profile.authMethod);
            }
        } else {
            // Check for stored profile to pre-fill anonymousId
            const profile = getUserProfile();
            if (profile?.anonymousId) {
                setAnonymousId(profile.anonymousId);
            }
        }
    }, []);

    const handleCheckIn = async () => {
        setLoading(true);
        setMessage(null);
        setShowAuthChoice(false);
        setShowExistingCredChoice(false);
        setPendingAnonymousId(null);

        try {
            const id = anonymousId || uuidv4();
            setAnonymousId(id);

            // Check if we have existing credentials for this ID
            const existingCreds = await checkStoredCredentials(id);
            
            if (existingCreds.hasCredential && existingCreds.isValid) {
                // Show choice dialog - use existing or create new
                setExistingCredInfo({ method: existingCreds.method });
                setShowExistingCredChoice(true);
                setPendingAnonymousId(id);
                setLoading(false);
                return;
            }

            // No existing credentials, try to register first (before check-in)
            await attemptCredentialRegistration(id);
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
            setLoading(false);
        }
    };

    // Step 1: Try to register credentials BEFORE creating check-in
    const attemptCredentialRegistration = async (id: string, forceMethod?: AuthMethod) => {
        setLoading(true);
        setMessage(null);

        try {
            const regResult = await registerCredentials(id, forceMethod, true);

            if (regResult.success) {
                // Credentials registered successfully, now create check-in
                await createCheckIn(id, regResult.method, regResult.credentialId, regResult.keyFingerprint);
            } else if (regResult.showChoiceDialog) {
                // WebAuthn was cancelled - show choice dialog (NOT checked in yet)
                setPendingAnonymousId(id);
                setShowAuthChoice(true);
                setMessage({
                    type: 'info',
                    text: 'Choose how to secure your check-in:',
                });
                setLoading(false);
            } else {
                setMessage({
                    type: 'error',
                    text: regResult.error || 'Failed to register credentials',
                });
                setLoading(false);
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to register credentials' });
            setLoading(false);
        }
    };

    // Step 2: Create check-in on server (only after credentials are ready)
    const createCheckIn = async (
        id: string, 
        method: AuthMethod | undefined, 
        credentialId?: string, 
        keyFingerprint?: string
    ) => {
        try {
            const response = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anonymousId: id,
                    deviceInfo: navigator.userAgent,
                    verificationMethod: method,
                    credentialId: credentialId || keyFingerprint,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('checkInId', data.id);
                localStorage.setItem('anonymousId', data.anonymousId);
                setAnonymousId(data.anonymousId);
                setIsCheckedIn(true);
                setAuthMethod(method || null);
                setShowAuthChoice(false);
                setPendingAnonymousId(null);
                setMessage({
                    type: 'success',
                    text: '',
                    anonymousId: data.anonymousId,
                    checkInId: data.id,
                    authMethod: method,
                });
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to check in' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    // When user has existing credentials and chooses to use them
    const handleUseExistingCred = async () => {
        if (!pendingAnonymousId) return;
        
        setLoading(true);
        setShowExistingCredChoice(false);
        
        try {
            // Reuse existing credentials (don't force new)
            const regResult = await registerCredentials(pendingAnonymousId, undefined, false);
            
            if (regResult.success) {
                await createCheckIn(
                    pendingAnonymousId, 
                    regResult.method, 
                    regResult.credentialId, 
                    regResult.keyFingerprint
                );
            } else {
                setMessage({ type: 'error', text: regResult.error || 'Failed to use existing credentials' });
                setLoading(false);
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to use existing credentials' });
            setLoading(false);
        }
    };

    // When user has existing credentials but wants new ones
    const handleCreateNewCred = async () => {
        if (!pendingAnonymousId) return;
        setShowExistingCredChoice(false);
        await attemptCredentialRegistration(pendingAnonymousId);
    };

    // Retry WebAuthn after cancellation
    const handleRetryWebAuthn = async () => {
        if (!pendingAnonymousId) return;
        setShowAuthChoice(false);
        await attemptCredentialRegistration(pendingAnonymousId, 'webauthn');
    };

    // Use software key after WebAuthn cancellation
    const handleUseSoftwareKey = async () => {
        if (!pendingAnonymousId) return;
        setShowAuthChoice(false);
        await attemptCredentialRegistration(pendingAnonymousId, 'software');
    };

    const handleCheckOut = async () => {
        const checkInId = localStorage.getItem('checkInId');
        const storedAnonymousId = localStorage.getItem('anonymousId');
        
        if (!checkInId || !storedAnonymousId) {
            setMessage({ type: 'error', text: 'No active check-in found' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            setMessage({ type: 'info', text: 'Verifying your identity...' });
            
            const verifyResult = await verifyForCheckout(storedAnonymousId);
            
            if (!verifyResult.success) {
                setMessage({ 
                    type: 'error', 
                    text: verifyResult.error || 'Identity verification failed.' 
                });
                setLoading(false);
                return;
            }

            const response = await fetch(`/api/checkin/${checkInId}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ anonymousId: storedAnonymousId, verified: true }),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Checked out successfully!' });
                localStorage.removeItem('checkInId');
                localStorage.removeItem('anonymousId');
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

    const handleStartFresh = () => {
        setShowStartFreshConfirm(true);
    };

    const confirmStartFresh = () => {
        purgeAllCredentials();
        setAnonymousId('');
        setAuthMethod(null);
        setShowStartFreshConfirm(false);
        setMessage({ type: 'success', text: 'Credentials cleared. You can now start fresh.' });
    };

    const cancelPendingCheckIn = () => {
        setShowAuthChoice(false);
        setShowExistingCredChoice(false);
        setPendingAnonymousId(null);
        setMessage(null);
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Check-In System</h2>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="anonymousId" className="block text-sm font-medium text-gray-700 mb-2">
                        Anonymous ID {isCheckedIn ? '(Currently Checked In)' : '(optional)'}
                    </label>
                    <input
                        id="anonymousId"
                        type="text"
                        value={anonymousId}
                        onChange={(e) => setAnonymousId(e.target.value)}
                        placeholder={isCheckedIn ? "Your current ID" : "Leave empty for auto-generation"}
                        maxLength={100}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-800 ${
                            isCheckedIn || showAuthChoice || showExistingCredChoice ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                        disabled={loading || isCheckedIn || showAuthChoice || showExistingCredChoice}
                        readOnly={isCheckedIn}
                    />
                </div>

                {/* Auth method indicator */}
                {isCheckedIn && authMethod && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                        {authMethod === 'webauthn' ? <PasskeyIcon /> : <SoftwareKeyIcon />}
                        <span>Secured with: {getAuthMethodLabel(authMethod)}</span>
                    </div>
                )}

                {/* Existing credential choice dialog */}
                {showExistingCredChoice && existingCredInfo && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800 mb-3 flex items-center gap-2">
                            {existingCredInfo.method === 'webauthn' ? <PasskeyIcon /> : <SoftwareKeyIcon />}
                            Existing {existingCredInfo.method === 'webauthn' ? 'passkey' : 'software key'} found for this ID
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleUseExistingCred}
                                disabled={loading}
                                className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 disabled:bg-gray-400 text-sm font-medium"
                            >
                                Use Existing
                            </button>
                            <button
                                onClick={handleCreateNewCred}
                                disabled={loading}
                                className="flex-1 bg-gray-600 text-white py-2 px-3 rounded-md hover:bg-gray-700 disabled:bg-gray-400 text-sm font-medium"
                            >
                                Create New
                            </button>
                        </div>
                        <button
                            onClick={cancelPendingCheckIn}
                            className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* WebAuthn cancelled choice dialog */}
                {showAuthChoice && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm text-amber-800 mb-3">
                            Choose how to secure your check-in:
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
                                Software Key
                            </button>
                        </div>
                        <button
                            onClick={cancelPendingCheckIn}
                            className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Start Fresh confirmation */}
                {showStartFreshConfirm && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-800 mb-2 font-medium">⚠️ Start Fresh?</p>
                        <p className="text-sm text-red-700 mb-3">
                            This will clear your stored credentials from this app, unlinking any existing passkeys or software keys.
                        </p>
                        {(authMethod === 'webauthn' || getUserProfile()?.authMethod === 'webauthn') && (
                            <div className="text-xs text-red-600 mb-3 p-2 bg-red-100 rounded">
                                <p className="font-medium mb-1">To fully delete a passkey from your device:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li><strong>Windows:</strong> Settings → Accounts → Passkeys</li>
                                    <li><strong>macOS:</strong> System Settings → Passwords</li>
                                    <li><strong>iOS:</strong> Settings → Passwords</li>
                                    <li><strong>Android:</strong> Settings → Passwords & accounts</li>
                                    <li><strong>Chrome:</strong> chrome://settings/passkeys</li>
                                </ul>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowStartFreshConfirm(false)}
                                className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 rounded-md hover:bg-gray-300 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmStartFresh}
                                className="flex-1 bg-red-500 text-white py-2 px-3 rounded-md hover:bg-red-600 text-sm font-medium"
                            >
                                Clear & Start Fresh
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleCheckIn}
                        disabled={loading || isCheckedIn || showAuthChoice || showExistingCredChoice}
                        className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {loading ? 'Processing...' : isCheckedIn ? 'Checked In' : 'Check In'}
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
                                <div className="font-mono text-xs">
                                    <p>• Anonymous ID: <span className="font-bold">{message.anonymousId}</span></p>
                                    <p>• Check-In ID: <span className="font-bold">{message.checkInId}</span></p>
                                </div>
                                {message.authMethod && (
                                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-green-200">
                                        {message.authMethod === 'webauthn' ? <PasskeyIcon /> : <SoftwareKeyIcon />}
                                        <span>{getAuthMethodLabel(message.authMethod)}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm">{message.text}</p>
                        )}
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        Credentials are stored locally for reuse.
                    </p>
                    {!isCheckedIn && !showAuthChoice && !showExistingCredChoice && (
                        <button
                            onClick={handleStartFresh}
                            className="text-xs text-gray-500 hover:text-red-600 underline"
                        >
                            Start Fresh
                        </button>
                    )}
                </div>
                
                <div>  
                    <Link href="/dashboard" className="block text-center bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-900 transition-colors font-medium">
                        View Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}