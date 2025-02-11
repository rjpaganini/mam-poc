/**
 * @file: MediaLibrary.js
 * @type: Page Component
 * @description: Main page component for the Media Asset Management system.
 * 
 * This is the primary entry point for the media library interface. It serves as a container
 * for displaying and managing media assets. Key responsibilities include:
 * 
 * - Fetching and displaying the list of media assets with pagination
 * - Managing the grid/list view layout
 * - Handling asset selection and navigation
 * - Managing loading and error states with retries
 * - Coordinating between child components
 * 
 * @author: Senior Dev - 2024
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import MediaGrid from '../components/MediaGrid';
import config from '../config';

// Core styled components with minimal token usage
const Container = ({ children }) => (
    <Box sx={{ 
        p: 3, 
        bgcolor: 'background.default', 
        minHeight: '100vh' 
    }}>
        {children}
    </Box>
);

const ErrorMessage = ({ message, onRetry }) => (
    <Box sx={{ 
        p: 2, 
        mb: 2, 
        color: 'error.main',
        bgcolor: 'background.paper',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    }}>
        <Typography>{message}</Typography>
        {onRetry && (
            <Button 
                onClick={onRetry} 
                variant="outlined" 
                color="primary" 
                size="small"
            >
                Retry
            </Button>
        )}
    </Box>
);

const MediaLibrary = () => {
    // Essential state management with pagination
    const [state, setState] = useState({
        assets: [],
        loading: true,
        error: null,
        page: 1,
        hasMore: true
    });
    
    // Refs for cleanup and abort control
    const abortController = useRef(null);
    const mounted = useRef(true);

    // Fetch assets with error handling and retries
    const fetchAssets = useCallback(async (page = 1, retryCount = 0) => {
        if (abortController.current) {
            abortController.current.abort();
        }
        
        abortController.current = new AbortController();
        
        try {
            setState(s => ({ ...s, loading: true, error: null }));
            
            const url = `${config.api.baseURL}${config.api.prefix}${config.api.endpoints.assets}?page=${page}&limit=20`;
            const res = await fetch(url, { signal: abortController.current.signal });
            
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            
            const data = await res.json();
            
            if (mounted.current) {
                setState(s => ({ 
                    ...s, 
                    assets: page === 1 ? data.assets : [...s.assets, ...data.assets],
                    hasMore: data.hasMore,
                    page,
                    loading: false 
                }));
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            
            if (retryCount < 3 && mounted.current) {
                setTimeout(() => fetchAssets(page, retryCount + 1), 1000 * (retryCount + 1));
            } else if (mounted.current) {
                setState(s => ({ 
                    ...s, 
                    error: `Failed to load media assets: ${err.message}`,
                    loading: false 
                }));
            }
        }
    }, []);

    // Load more assets
    const loadMore = useCallback(() => {
        if (!state.loading && state.hasMore) {
            fetchAssets(state.page + 1);
        }
    }, [state.loading, state.hasMore, state.page, fetchAssets]);

    // Initial fetch and cleanup
    useEffect(() => {
        fetchAssets(1);
        
        return () => {
            mounted.current = false;
            if (abortController.current) {
                abortController.current.abort();
            }
        };
    }, [fetchAssets]);

    return (
        <Container>
            <Typography variant="h5" sx={{ mb: 3 }}>Media Library</Typography>
            
            {state.error && (
                <ErrorMessage 
                    message={state.error} 
                    onRetry={() => fetchAssets(state.page)} 
                />
            )}
            
            {state.assets.length > 0 && (
                <MediaGrid 
                    assets={state.assets} 
                    onLoadMore={loadMore}
                    hasMore={state.hasMore}
                />
            )}
            
            {state.loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            )}
            
            {!state.loading && state.assets.length === 0 && !state.error && (
                <Typography color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                    No media assets found
                </Typography>
            )}
        </Container>
    );
};

export default MediaLibrary; 