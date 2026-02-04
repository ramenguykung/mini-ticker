'use client';

import { useState, useEffect } from 'react';

interface Passkey {
  id: string;
  credentialId: string;
  name: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

interface PasskeyManagerProps {
  anonymousId: string;
  onAddPasskey: () => Promise<void>;
}

export default function PasskeyManager({ anonymousId, onAddPasskey }: PasskeyManagerProps) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPasskeys = async () => {
    try {
      const response = await fetch(`/api/auth/passkeys?anonymousId=${anonymousId}`);
      if (response.ok) {
        const data = await response.json();
        setPasskeys(data.passkeys);
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err);
    }
  };

  useEffect(() => {
    if (expanded) {
      loadPasskeys();
    }
  }, [expanded, anonymousId]);

  const handleRename = async (id: string) => {
    if (!editingName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/passkeys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, name: editingName.trim() }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditingName('');
        await loadPasskeys();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to rename passkey');
      }
    } catch (err) {
      setError('Failed to rename passkey');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this passkey? You will lose access from this device.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/passkeys/${id}?anonymousId=${anonymousId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadPasskeys();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete passkey');
      }
    } catch (err) {
      setError('Failed to delete passkey');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPasskey = async () => {
    setLoading(true);
    setError(null);
    try {
      await onAddPasskey();
      await loadPasskeys();
    } catch (err) {
      setError('Failed to add passkey');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getDeviceIcon = (transports: string[]) => {
    if (transports.includes('internal')) {
      return '📱'; // Phone/built-in
    } else if (transports.includes('usb')) {
      return '🔑'; // USB security key
    } else if (transports.includes('ble') || transports.includes('nfc')) {
      return '📡'; // Wireless key
    }
    return '🔐'; // Generic
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <span>Manage Passkeys ({passkeys.length})</span>
        <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          {passkeys.length === 0 ? (
            <p className="text-sm text-gray-500">No passkeys registered yet.</p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getDeviceIcon(passkey.transports)}</span>
                        {editingId === passkey.id ? (
                          <div className="flex gap-2 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Passkey name"
                              autoFocus
                              maxLength={100}
                            />
                            <button
                              onClick={() => handleRename(passkey.id)}
                              disabled={loading}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-400"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditingName('');
                              }}
                              className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">
                              {passkey.name || 'Unnamed Passkey'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Created: {formatDate(passkey.createdAt)}
                            </p>
                            {passkey.lastUsedAt && (
                              <p className="text-xs text-gray-500">
                                Last used: {formatDate(passkey.lastUsedAt)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {editingId !== passkey.id && (
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => {
                            setEditingId(passkey.id);
                            setEditingName(passkey.name || '');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(passkey.id)}
                          disabled={loading || passkeys.length === 1}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                          title={passkeys.length === 1 ? "Can't delete your only passkey" : ''}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAddPasskey}
            disabled={loading}
            className="w-full bg-gray-600 text-white py-2 px-3 rounded-md hover:bg-gray-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {loading ? 'Adding...' : '+ Add New Passkey'}
          </button>
        </div>
      )}
    </div>
  );
}
