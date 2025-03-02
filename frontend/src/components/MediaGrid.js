import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import AssetCard from './MediaLibrary/AssetCard';
import config from '../config';
import { useWebSocketService } from '../hooks/useWebSocketService';
import logger from '../services/logger';

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: ${props => props.theme.spacing.lg};
`;

const SortControls = styled.div`
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    align-items: center;
`;

const Select = styled.select`
    padding: 0.5rem;
    border-radius: ${props => props.theme.radius.sm};
    border: 1px solid ${props => props.theme.colors.border};
    background: ${props => props.theme.colors.surface};
    color: ${props => props.theme.colors.text.primary};
`;

// Sorting options
const sortOptions = [
    { value: 'title', label: 'Title' },
    { value: 'duration', label: 'Duration' },
    { value: 'fps', label: 'FPS' },
    { value: 'size', label: 'File Size' },
    { value: 'resolution', label: 'Resolution' }
];

const MediaGrid = ({ assets: initialAssets }) => {
    const navigate = useNavigate();
    const [sortBy, setSortBy] = useState('title');
    const [sortDirection, setSortDirection] = useState('asc');
    const [assets, setAssets] = useState(initialAssets);

    // Initialize WebSocket connection
    const { isConnected } = useWebSocketService({
        onMessage: (message) => {
            try {
                if (message.type === 'asset_update') {
                    // Update the specific asset in the grid
                    setAssets(currentAssets => {
                        const updatedAssets = [...currentAssets];
                        const index = updatedAssets.findIndex(a => a.id === message.asset.id);
                        if (index !== -1) {
                            // Ensure all required fields are present
                            const updatedAsset = {
                                ...updatedAssets[index],
                                ...message.asset,
                                duration: message.asset.duration || updatedAssets[index].duration,
                                thumbnail_url: message.asset.thumbnail_url || updatedAssets[index].thumbnail_url
                            };
                            updatedAssets[index] = updatedAsset;
                            logger.debug('Asset updated:', updatedAsset);
                        }
                        return updatedAssets;
                    });
                }
            } catch (error) {
                logger.error('Error processing WebSocket message:', error);
            }
        },
        onError: (error) => {
            logger.error('WebSocket error in MediaGrid:', error);
        }
    });

    // Update assets when initialAssets changes
    useEffect(() => {
        setAssets(initialAssets);
    }, [initialAssets]);

    // Sort assets based on current criteria
    const sortedAssets = [...assets].sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
            case 'title':
                comparison = (a.title || '').localeCompare(b.title || '');
                break;
            case 'duration':
                comparison = (a.duration || 0) - (b.duration || 0);
                break;
            case 'fps':
                comparison = (a.fps || 0) - (b.fps || 0);
                break;
            case 'size':
                comparison = (a.file_size || 0) - (b.file_size || 0);
                break;
            case 'resolution':
                const resA = (a.width || 0) * (a.height || 0);
                const resB = (b.width || 0) * (b.height || 0);
                comparison = resA - resB;
                break;
            default:
                comparison = 0;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    return (
        <div>
            <SortControls>
                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    {sortOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            Sort by {option.label}
                        </option>
                    ))}
                </Select>
                <Select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)}>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </Select>
            </SortControls>
            <Grid>
                {sortedAssets.map(asset => (
                    <AssetCard 
                        key={asset.id} 
                        asset={asset} 
                        onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                    />
                ))}
            </Grid>
        </div>
    );
};

export default MediaGrid; 