import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { InventoryItem } from '../types';

export default function Expiring() {
  const [expiringItems, setExpiringItems] = useState<InventoryItem[]>([]);
  const [expiredItems, setExpiredItems] = useState<InventoryItem[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExpiringItems();
    loadExpiredItems();
  }, [days]);

  const loadExpiringItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getExpiringItems(days);
      setExpiringItems(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load expiring items');
    } finally {
      setLoading(false);
    }
  };

  const loadExpiredItems = async () => {
    try {
      const data = await apiClient.getExpiredItems();
      setExpiredItems(data);
    } catch (err: any) {
      console.error('Failed to load expired items:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">⚠️ Expiring Items</h1>
        <p className="text-gray-600">Monitor items that are expiring soon or have expired</p>
      </div>

      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Days ahead to check: {days}
        </label>
        <input
          type="range"
          min="1"
          max="30"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Expired Items */}
      {expiredItems.length > 0 && (
        <div className="card mb-6 border-2 border-red-300">
          <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Expired Items ({expiredItems.length})</h2>
          <div className="space-y-4">
            {expiredItems.map((item) => (
              <div
                key={item.id}
                className="border border-red-200 rounded-lg p-4 bg-red-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">{item.product_name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-600">
                      Expired: {formatDate(item.expiration_date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {item.quantity} {item.unit} • 📍 {item.storage_location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Soon */}
      <div className="card">
        <h2 className="text-2xl font-bold text-orange-600 mb-4">
          ⚠️ Expiring in {days} days ({expiringItems.length})
        </h2>

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : error ? (
          <p className="text-red-600">Error: {error}</p>
        ) : expiringItems.length === 0 ? (
          <p className="text-gray-600">No items expiring in the next {days} days! 🎉</p>
        ) : (
          <div className="space-y-4">
            {expiringItems.map((item) => (
              <div
                key={item.id}
                className="border border-orange-200 rounded-lg p-4 bg-orange-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">{item.product_name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-600">
                      Expires: {formatDate(item.expiration_date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {item.quantity} {item.unit} • 📍 {item.storage_location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

