import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { InventoryItem, SourceDirectory, ProcessImageResult, RefreshInventoryResult } from '../types';

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  
  // Image processing
  const [sourceDir, setSourceDir] = useState<SourceDirectory | null>(null);
  const [newSourceDir, setNewSourceDir] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshInventoryResult | null>(null);
  
  // Add item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    brand: '',
    quantity: 1,
    unit: 'count',
    storage_location: 'pantry' as 'pantry' | 'fridge' | 'freezer',
    status: 'in_stock' as 'in_stock' | 'low',
    expiration_date: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Edit item form
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    quantity: 1,
    unit: 'count',
    storage_location: 'pantry' as 'pantry' | 'fridge' | 'freezer',
    status: 'in_stock' as 'in_stock' | 'low',
    expiration_date: '',
    purchase_date: '',
    notes: '',
  });

  useEffect(() => {
    loadInventory();
    loadSourceDirectory();
  }, [locationFilter, statusFilter]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const location = locationFilter === 'All' ? undefined : locationFilter;
      const status = statusFilter === 'All' ? undefined : statusFilter;
      const data = await apiClient.getInventory(0, 1000, location, status);
      setItems(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadSourceDirectory = async () => {
    try {
      const data = await apiClient.getSourceDirectory();
      setSourceDir(data);
      setNewSourceDir(data.source_directory);
    } catch (err) {
      console.error('Failed to load source directory:', err);
    }
  };

  const handleSaveSourceDirectory = async () => {
    try {
      await apiClient.setSourceDirectory(newSourceDir);
      await loadSourceDirectory();
      alert('Source directory updated!');
    } catch (err: any) {
      alert(`Failed to update directory: ${err.message}`);
    }
  };

  const handleRefreshInventory = async () => {
    try {
      setRefreshing(true);
      const result = await apiClient.refreshInventory({
        storage_location: 'pantry',
        min_confidence: 0.6,
      });
      setRefreshResult(result);
      await loadInventory();
      alert('Inventory refreshed successfully!');
    } catch (err: any) {
      alert(`Failed to refresh inventory: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleProcessImage = async (file: File) => {
    try {
      setProcessingImage(true);
      const result = await apiClient.processImage(file, 'pantry');
      if (result.success) {
        alert(`Successfully processed: ${result.item.product_name || 'Unknown'}`);
        await loadInventory();
      } else {
        alert('Failed to process image');
      }
    } catch (err: any) {
      alert(`Failed to process image: ${err.message}`);
    } finally {
      setProcessingImage(false);
    }
  };

  const handleAddItem = async () => {
    if (!formData.product_name) {
      alert('Product name is required!');
      return;
    }

    try {
      // Create or find product
      let productId: number;
      try {
        const existing = await apiClient.searchProducts(formData.product_name);
        if (existing.length > 0) {
          productId = existing[0].id;
        } else {
          const product = await apiClient.createProduct({
            product_name: formData.product_name,
            brand: formData.brand || undefined,
          });
          productId = product.id;
        }
      } catch {
        const product = await apiClient.createProduct({
          product_name: formData.product_name,
          brand: formData.brand || undefined,
        });
        productId = product.id;
      }

      // Create inventory item
      await apiClient.createInventoryItem({
        product_id: productId,
        quantity: formData.quantity,
        unit: formData.unit,
        storage_location: formData.storage_location,
        status: formData.status,
        purchase_date: formData.purchase_date || undefined,
        expiration_date: formData.expiration_date || undefined,
        notes: formData.notes || undefined,
      });

      alert(`Added ${formData.product_name} to inventory!`);
      setShowAddForm(false);
      setFormData({
        product_name: '',
        brand: '',
        quantity: 1,
        unit: 'count',
        storage_location: 'pantry',
        status: 'in_stock',
        expiration_date: '',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      await loadInventory();
    } catch (err: any) {
      alert(`Failed to add item: ${err.message}`);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await apiClient.deleteInventoryItem(itemId);
      await loadInventory();
    } catch (err: any) {
      alert(`Failed to delete item: ${err.message}`);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setEditFormData({
      quantity: item.quantity,
      unit: item.unit,
      storage_location: item.storage_location || 'pantry',
      status: item.status as 'in_stock' | 'low',
      expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
      purchase_date: item.purchase_date ? item.purchase_date.split('T')[0] : '',
      notes: item.notes || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditFormData({
      quantity: 1,
      unit: 'count',
      storage_location: 'pantry',
      status: 'in_stock',
      expiration_date: '',
      purchase_date: '',
      notes: '',
    });
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      await apiClient.updateInventoryItem(editingItem.id, {
        quantity: editFormData.quantity,
        unit: editFormData.unit,
        storage_location: editFormData.storage_location,
        status: editFormData.status,
        expiration_date: editFormData.expiration_date || undefined,
        purchase_date: editFormData.purchase_date || undefined,
        notes: editFormData.notes || undefined,
      });

      alert('Item updated successfully!');
      setEditingItem(null);
      await loadInventory();
    } catch (err: any) {
      alert(`Failed to update item: ${err.message}`);
    }
  };

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const name = item.product_name?.toLowerCase() || '';
      return name.includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📦 Inventory Management</h1>
        <p className="text-gray-600">View and manage all pantry items</p>
      </div>

      {/* Image Processing Section */}
      <div className="card mb-6">
        <details className="group">
          <summary className="cursor-pointer text-lg font-semibold text-gray-900 mb-4">
            📸 Process Images
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Source Directory */}
            <div>
              <h3 className="font-semibold mb-2">📁 Source Directory</h3>
              {sourceDir && (
                <div className="mb-4">
                  {sourceDir.exists ? (
                    <p className="text-green-600 mb-2">✅ {sourceDir.source_directory}</p>
                  ) : (
                    <p className="text-orange-600 mb-2">⚠️ {sourceDir.source_directory} (does not exist)</p>
                  )}
                </div>
              )}
              <input
                type="text"
                value={newSourceDir}
                onChange={(e) => setNewSourceDir(e.target.value)}
                placeholder="~/Pictures/Pantry"
                className="input mb-2"
              />
              <button onClick={handleSaveSourceDirectory} className="btn-primary w-full">
                💾 Save Directory
              </button>
            </div>

            {/* Refresh Inventory */}
            <div>
              <h3 className="font-semibold mb-2">🔄 Refresh Inventory</h3>
              <p className="text-sm text-gray-600 mb-4">Process all new images from source directory</p>
              <button
                onClick={handleRefreshInventory}
                disabled={refreshing}
                className="btn-primary w-full"
              >
                {refreshing ? 'Processing...' : '🔄 Refresh Inventory'}
              </button>
              {refreshResult && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="font-semibold mb-2">Results:</p>
                  <ul className="text-sm space-y-1">
                    <li>✅ Processed: {refreshResult.results.processed}</li>
                    <li>⏭️ Skipped: {refreshResult.results.skipped}</li>
                    <li>❌ Failed: {refreshResult.results.failed}</li>
                    <li>📦 Items Created: {refreshResult.results.items_created}</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Add Item Form */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">➕ Add New Item</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-secondary"
          >
            {showAddForm ? 'Hide' : 'Show'} Form
          </button>
        </div>

        {showAddForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="e.g., Olive Oil"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g., Bertolli"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                min="0.1"
                step="0.1"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="input"
              >
                <option value="count">count</option>
                <option value="oz">oz</option>
                <option value="ml">ml</option>
                <option value="lb">lb</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location *
              </label>
              <select
                value={formData.storage_location}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    storage_location: e.target.value as 'pantry' | 'fridge' | 'freezer',
                  })
                }
                className="input"
              >
                <option value="pantry">pantry</option>
                <option value="fridge">fridge</option>
                <option value="freezer">freezer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as 'in_stock' | 'low',
                  })
                }
                className="input"
              >
                <option value="in_stock">in_stock</option>
                <option value="low">low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date
              </label>
              <input
                type="date"
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information..."
                className="input"
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <button onClick={handleAddItem} className="btn-primary w-full">
                Add Item
              </button>
            </div>
          </div>
        )}

        {/* Single Image Upload */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold mb-2">📷 Process Single Image</h3>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessImage(file);
            }}
            disabled={processingImage}
            className="input mb-2"
          />
          {processingImage && <p className="text-sm text-gray-600">Processing image...</p>}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📍 Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="input"
            >
              <option value="All">All</option>
              <option value="pantry">pantry</option>
              <option value="fridge">fridge</option>
              <option value="freezer">freezer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="All">All</option>
              <option value="in_stock">in_stock</option>
              <option value="low">low</option>
              <option value="expired">expired</option>
              <option value="consumed">consumed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">✏️ Edit Item: {editingItem.product_name}</h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: parseFloat(e.target.value) })}
                  min="0.1"
                  step="0.1"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                <select
                  value={editFormData.unit}
                  onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                  className="input"
                >
                  <option value="count">count</option>
                  <option value="oz">oz</option>
                  <option value="ml">ml</option>
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <select
                  value={editFormData.storage_location}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      storage_location: e.target.value as 'pantry' | 'fridge' | 'freezer',
                    })
                  }
                  className="input"
                >
                  <option value="pantry">pantry</option>
                  <option value="fridge">fridge</option>
                  <option value="freezer">freezer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      status: e.target.value as 'in_stock' | 'low',
                    })
                  }
                  className="input"
                >
                  <option value="in_stock">in_stock</option>
                  <option value="low">low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={editFormData.expiration_date}
                  onChange={(e) => setEditFormData({ ...editFormData, expiration_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={editFormData.purchase_date}
                  onChange={(e) => setEditFormData({ ...editFormData, purchase_date: e.target.value })}
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Additional information..."
                  className="input"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button onClick={handleUpdateItem} className="btn-primary flex-1">
                  💾 Save Changes
                </button>
                <button onClick={handleCancelEdit} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory List */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Found {filteredItems.length} items</h2>

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : error ? (
          <p className="text-red-600">Error: {error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-gray-600">No items found. Add your first item using the form above!</p>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-lg">{item.product_name || 'Unknown'}</h3>
                    {item.brand && <p className="text-sm text-gray-600">Brand: {item.brand}</p>}
                  </div>
                  <div>
                    <p className="font-medium">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      📍 {item.storage_location?.charAt(0).toUpperCase()}
                      {item.storage_location?.slice(1)}
                    </p>
                    {item.expiration_date && (
                      <p className="text-sm text-gray-600">📅 Exp: {item.expiration_date}</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEditItem(item)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit item"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete item"
                    >
                      🗑️
                    </button>
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

