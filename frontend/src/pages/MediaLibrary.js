import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import MediaGrid from '../components/MediaGrid';
import config from '../config';

const Container = styled.div`
    padding: ${props => props.theme.spacing.lg};
    background: ${props => props.theme.colors.background};
    min-height: 100vh;
`;

const Header = styled.div`
    margin-bottom: ${props => props.theme.spacing.xl};
`;

const Title = styled.h1`
    color: ${props => props.theme.colors.text.primary};
    margin: 0;
    margin-bottom: ${props => props.theme.spacing.md};
`;

const LoadingOverlay = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: ${props => props.theme.spacing.xl};
    color: ${props => props.theme.colors.text.secondary};
`;

const ErrorMessage = styled.div`
    color: ${props => props.theme.colors.error};
    padding: ${props => props.theme.spacing.lg};
    background: ${props => props.theme.colors.surface};
    border-radius: ${props => props.theme.radius.md};
    margin-bottom: ${props => props.theme.spacing.lg};
`;

const MediaLibrary = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${config.api.baseURL}/api/v1/assets`);
                if (!response.ok) throw new Error('Failed to fetch assets');
                
                const data = await response.json();
                setAssets(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching assets:', err);
                setError('Failed to load media assets. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, []);

    return (
        <Container>
            <Header>
                <Title>Media Library</Title>
            </Header>

            {error && <ErrorMessage>{error}</ErrorMessage>}
            
            {loading ? (
                <LoadingOverlay>Loading media assets...</LoadingOverlay>
            ) : assets.length === 0 ? (
                <LoadingOverlay>No media assets found</LoadingOverlay>
            ) : (
                <MediaGrid assets={assets} />
            )}
        </Container>
    );
};

export default MediaLibrary; 