import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Pantry } from '../types';

interface PantrySelectorProps {
  selectedPantryId?: number;
  onPantryChange: (pantryId: number | undefined) => void;
  showCreateButton?: boolean;
}

export const PantrySelector: React.FC<PantrySelectorProps> = ({
  selectedPantryId,
  onPantryChange,
  showCreateButton = true,
}) => {
  const [pantries, setPantries] = useState<Pantry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPantryName, setNewPantryName] = useState('');
  const [newPantryDescription, setNewPantryDescription] = useState('');
  const [newPantryLocation, setNewPantryLocation] = useState('');

  useEffect(() => {
    loadPantries();
  }, []);

  const loadPantries = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPantries();
      setPantries(data);
      
      // If no pantry is selected and we have pantries, select the default one
      if (!selectedPantryId && data.length > 0) {
        const defaultPantry = data.find(p => p.is_default) || data[0];
        onPantryChange(defaultPantry.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pantries');
      console.error('Error loading pantries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePantry = async () => {
    if (!newPantryName.trim()) {
      setError('Pantry name is required');
      return;
    }

    try {
      const newPantry = await apiClient.createPantry({
        name: newPantryName.trim(),
        description: newPantryDescription.trim() || undefined,
        location: newPantryLocation.trim() || undefined,
        is_default: pantries.length === 0, // First pantry is default
      });
      
      setPantries([...pantries, newPantry]);
      onPantryChange(newPantry.id);
      setShowCreateModal(false);
      setNewPantryName('');
      setNewPantryDescription('');
      setNewPantryLocation('');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create pantry');
      console.error('Error creating pantry:', err);
    }
  };

  if (loading) {
    return <div className="pantry-selector loading">Loading pantries...</div>;
  }

  return (
    <div className="pantry-selector">
      <label htmlFor="pantry-select" style={{ marginRight: '8px' }}>
        Pantry:
      </label>
      <select
        id="pantry-select"
        value={selectedPantryId || ''}
        onChange={(e) => onPantryChange(e.target.value ? parseInt(e.target.value) : undefined)}
        style={{ padding: '4px 8px', marginRight: '8px' }}
      >
        {pantries.map((pantry) => (
          <option key={pantry.id} value={pantry.id}>
            {pantry.name} {pantry.is_default && '(Default)'}
          </option>
        ))}
      </select>
      
      {showCreateButton && (
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ padding: '4px 12px', marginLeft: '8px' }}
        >
          + New Pantry
        </button>
      )}

      {error && <div style={{ color: 'red', marginTop: '8px' }}>{error}</div>}

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Create New Pantry</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>
                Name: <span style={{ color: 'red' }}>*</span>
                <input
                  type="text"
                  value={newPantryName}
                  onChange={(e) => setNewPantryName(e.target.value)}
                  style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                  placeholder="e.g., Home, Office, Vacation Home"
                />
              </label>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>
                Description:
                <input
                  type="text"
                  value={newPantryDescription}
                  onChange={(e) => setNewPantryDescription(e.target.value)}
                  style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                  placeholder="Optional description"
                />
              </label>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>
                Location:
                <input
                  type="text"
                  value={newPantryLocation}
                  onChange={(e) => setNewPantryLocation(e.target.value)}
                  style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                  placeholder="Optional address/location"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button onClick={handleCreatePantry}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

