'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function CheckInForm() {
    const [anonymousId, setAnonymousId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; anonymousId?: string; checkInId?: string } | null>(null);

    const handleCheckIn = async () => {
        setLoading(true);
        setMessage(null);

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
                setMessage({ 
                    type: 'success', 
                    text: '',
                    anonymousId: data.anonymousId,
                    checkInId: data.id
                });
                localStorage.setItem('checkInId', data.id);
                localStorage.setItem('anonymousId', data.anonymousId);
                setAnonymousId('');
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to check in' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        const checkInId = localStorage.getItem('checkInId');
        const storedAnonymousId = localStorage.getItem('anonymousId');
        
        if (!checkInId) {
            setMessage({ type: 'error', text: 'No active check-in found' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch(`/api/checkin/${checkInId}/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    anonymousId: storedAnonymousId,
                }),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Checked out successfully!' });
                localStorage.removeItem('checkInId');
                localStorage.removeItem('anonymousId');
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
                        Anonymous ID (optional - auto-generated if empty)
                    </label>
                    <input
                        id="anonymousId"
                        type="text"
                        value={anonymousId}
                        onChange={(e) => setAnonymousId(e.target.value)}
                        placeholder="Leave empty for auto-generation"
                        maxLength={100}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-800"
                        disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">Max 100 characters</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleCheckIn}
                        disabled={loading}
                        className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {loading ? 'Processing...' : 'Check In'}
                    </button>

                    <button
                        onClick={handleCheckOut}
                        disabled={loading}
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
                            <p className="text-md">Use your <strong>Anonymous ID</strong> to check out<br/><strong><u>You&apos;ll need the Check-In ID</u></strong> to delete your session from the list.</p>
                            </div>
                        ) : (
                            <p className="text-sm">{message.text}</p>
                        )}
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                        Your anonymous ID is stored locally on your device and not shared.
                    </p>
                </div>
            </div>
        </div>
    );
}