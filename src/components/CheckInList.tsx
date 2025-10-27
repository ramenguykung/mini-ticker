'use client';

import { useEffect, useState } from 'react';

interface CheckIn {
    id: string;
    anonymousId: string;
    status: string;
    checkInTime: string;
    checkOutTime?: string;
}

export default function CheckInList() {
    const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);
    const [targetCheckoutId, setTargetCheckoutId] = useState<string | null>(null);
    const [checkInIdInput, setCheckInIdInput] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    const fetchCheckIns = async () => {
        try {
            const response = await fetch('/api/checkin');
            
            if (!response.ok) {
                throw new Error('Failed to fetch check-ins');
            }

            const data = await response.json();
            setCheckIns(data);
            setError(null);
        } catch (err) {
            setError('Failed to load check-ins');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCheckIns();
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchCheckIns, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleDelete = async (id: string) => {
        setTargetDeleteId(id);
        setCheckInIdInput('');
        setDeleteError(null);
        setDeleteModalOpen(true);
    };

    const handleCheckout = async (id: string) => {
        setTargetCheckoutId(id);
        setCheckInIdInput('');
        setCheckoutError(null);
        setCheckoutModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!targetDeleteId) return;

        if (checkInIdInput.trim() !== targetDeleteId) {
            setDeleteError('Incorrect Check-In ID. Deletion denied.');
            return;
        }

        try {
            const response = await fetch(`/api/checkin/${targetDeleteId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCheckIns(checkIns.filter(c => c.id !== targetDeleteId));
                setDeleteModalOpen(false);
                setTargetDeleteId(null);
                setCheckInIdInput('');
                setDeleteError(null);
            } else {
                setDeleteError('Failed to delete check-in. Please try again.');
            }
        } catch {
            setDeleteError('Network error. Please try again.');
        }
    };

    const cancelDelete = () => {
        setDeleteModalOpen(false);
        setTargetDeleteId(null);
        setCheckInIdInput('');
        setDeleteError(null);
    };

    const confirmCheckout = async () => {
        if (!targetCheckoutId) return;

        if (checkInIdInput.trim() !== targetCheckoutId) {
            setCheckoutError('Incorrect Check-In ID. Checkout denied.');
            return;
        }

        try {
            const response = await fetch(`/api/checkin/${targetCheckoutId}/checkout`, {
                method: 'POST',
            });

            if (response.ok) {
                // Refresh the list to show updated status
                await fetchCheckIns();
                setCheckoutModalOpen(false);
                setTargetCheckoutId(null);
                setCheckInIdInput('');
                setCheckoutError(null);
            } else {
                const data = await response.json();
                setCheckoutError(data.error || 'Failed to check out. Please try again.');
            }
        } catch {
            setCheckoutError('Network error. Please try again.');
        }
    };

    const cancelCheckout = () => {
        setCheckoutModalOpen(false);
        setTargetCheckoutId(null);
        setCheckInIdInput('');
        setCheckoutError(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{error}</p>
            </div>
        );
    }

    const activeCheckIns = checkIns.filter(c => c.status === 'active');
    const inactiveCheckIns = checkIns.filter(c => c.status !== 'active');

    return (
        <div className="space-y-6">
            {/* Active Check-Ins Section */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">Active Check-Ins</h2>
                    <p className="text-sm text-gray-600 mt-1">Total: {activeCheckIns.length}</p>
                </div>

                {activeCheckIns.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No active check-ins
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Anonymous ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Check-In Time
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {activeCheckIns.map((checkIn) => (
                                    <tr key={checkIn.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                            {checkIn.anonymousId.slice(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    checkIn.status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                {checkIn.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(checkIn.checkInTime).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                                            <button
                                                onClick={() => handleCheckout(checkIn.id)}
                                                className="text-blue-600 hover:text-blue-900 font-medium"
                                            >
                                                Check Out
                                            </button>
                                            <button
                                                onClick={() => handleDelete(checkIn.id)}
                                                className="text-red-600 hover:text-red-900 font-medium"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inactive Check-Ins Section */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">Inactive Check-Ins</h2>
                    <p className="text-sm text-gray-600 mt-1">Total: {inactiveCheckIns.length}</p>
                </div>

                {inactiveCheckIns.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No inactive check-ins
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Anonymous ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Check-In Time
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Check-Out Time
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {inactiveCheckIns.map((checkIn) => (
                                    <tr key={checkIn.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                            {checkIn.anonymousId.slice(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                                {checkIn.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(checkIn.checkInTime).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {checkIn.checkOutTime 
                                                ? new Date(checkIn.checkOutTime).toLocaleString()
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => handleDelete(checkIn.id)}
                                                className="text-red-600 hover:text-red-900 font-medium"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            Confirm Deletion
                        </h3>
                        
                        <p className="text-sm text-gray-600 mb-4">
                            To delete this check-in session, please enter the <strong>Check-In ID</strong> that was provided when you checked in.
                        </p>

                        <div className="mb-4">
                            <label htmlFor="checkInIdInput" className="block text-sm font-medium text-gray-700 mb-2">
                                Check-In ID
                            </label>
                            <input
                                id="checkInIdInput"
                                type="text"
                                value={checkInIdInput}
                                onChange={(e) => {
                                    setCheckInIdInput(e.target.value);
                                    setDeleteError(null);
                                }}
                                placeholder="Enter Check-In ID"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-800 font-mono text-sm"
                                autoFocus
                            />
                        </div>

                        {deleteError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-800">{deleteError}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={cancelDelete}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Confirmation Modal */}
            {checkoutModalOpen && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            Confirm Check Out
                        </h3>
                        
                        <p className="text-sm text-gray-600 mb-4">
                            To check out from this session, please enter the <strong>Check-In ID</strong> that was provided when you checked in.
                        </p>

                        <div className="mb-4">
                            <label htmlFor="checkoutIdInput" className="block text-sm font-medium text-gray-700 mb-2">
                                Check-In ID
                            </label>
                            <input
                                id="checkoutIdInput"
                                type="text"
                                value={checkInIdInput}
                                onChange={(e) => {
                                    setCheckInIdInput(e.target.value);
                                    setCheckoutError(null);
                                }}
                                placeholder="Enter Check-In ID"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 font-mono text-sm"
                                autoFocus
                            />
                        </div>

                        {checkoutError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-800">{checkoutError}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={cancelCheckout}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCheckout}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                            >
                                Check Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}