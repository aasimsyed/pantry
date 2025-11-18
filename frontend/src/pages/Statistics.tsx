import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { Statistics } from '../types';

export default function Statistics() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getStatistics();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card">
          <p className="text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card border-2 border-red-300">
          <p className="text-red-600">Error: {error || 'Failed to load statistics'}</p>
        </div>
      </div>
    );
  }

  const byCategory = stats.by_category || {};
  const byLocation = stats.by_location || {};
  const byStatus = stats.by_status || {};

  const totalItems = Object.values(byCategory).reduce((sum, val) => sum + val, 0) || stats.total_items;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Pantry Statistics</h1>
        <p className="text-gray-600">Analytics and insights about your pantry inventory</p>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">{stats.total_items}</p>
          <p className="text-sm text-gray-600">Total Items</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">{stats.total_products}</p>
          <p className="text-sm text-gray-600">Products</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{stats.in_stock}</p>
          <p className="text-sm text-gray-600">In Stock</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-orange-600">{stats.expiring_soon}</p>
          <p className="text-sm text-gray-600">Expiring Soon</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          <p className="text-sm text-gray-600">Expired</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* By Category */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">📦 By Category</h2>
          {Object.keys(byCategory).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => {
                  const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
                  return (
                    <div key={category}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{category || 'Uncategorized'}</span>
                        <span className="text-sm text-gray-600">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-600">No category data available</p>
          )}
        </div>

        {/* By Location */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">📍 By Location</h2>
          {Object.keys(byLocation).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(byLocation)
                .sort(([, a], [, b]) => b - a)
                .map(([location, count]) => {
                  const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
                  return (
                    <div key={location}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{location}</span>
                        <span className="text-sm text-gray-600">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-600">No location data available</p>
          )}
        </div>
      </div>

      {/* By Status */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">📋 By Status</h2>
        {Object.keys(byStatus).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
                const statusColors: Record<string, string> = {
                  in_stock: 'bg-green-600',
                  low: 'bg-yellow-600',
                  expired: 'bg-red-600',
                  consumed: 'bg-gray-600',
                };
                return (
                  <div key={status}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">
                        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <span className="text-sm text-gray-600">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${statusColors[status] || 'bg-gray-600'} h-2 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-gray-600">No status data available</p>
        )}
      </div>

      {/* Detailed Breakdown Tables */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">📝 Detailed Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold mb-2">By Category</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <tr key={category} className="border-b">
                        <td className="py-2">{category || 'Uncategorized'}</td>
                        <td className="text-right py-2">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">By Location</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Location</th>
                    <th className="text-right py-2">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byLocation)
                    .sort(([, a], [, b]) => b - a)
                    .map(([location, count]) => (
                      <tr key={location} className="border-b">
                        <td className="py-2 capitalize">{location}</td>
                        <td className="text-right py-2">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">By Status</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Status</th>
                    <th className="text-right py-2">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byStatus)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <tr key={status} className="border-b">
                        <td className="py-2">
                          {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </td>
                        <td className="text-right py-2">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

