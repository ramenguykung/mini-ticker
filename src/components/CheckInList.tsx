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
        if (!confirm('Are you sure you want to delete this check-in?')) {
            return;
        }

        try {
            const response = await fetch(`/api/checkin/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCheckIns(checkIns.filter(c => c.id !== id));
            } else {
                alert('Failed to delete check-in');
            }
        } catch (error) {
            alert('Network error');
        }
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

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Active Check-Ins</h2>
                <p className="text-sm text-gray-600 mt-1">Total: {checkIns.length}</p>
            </div>

            {checkIns.length === 0 ? (
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
                            {checkIns.map((checkIn) => (
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
    );
}