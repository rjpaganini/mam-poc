import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaFolder, FaTrash, FaSync } from 'react-icons/fa';

const Container = styled.div`
    padding: ${props => props.theme.spacing.md};
    background: ${props => props.theme.colors.surface};
    border-radius: 8px;
    margin-bottom: ${props => props.theme.spacing.md};
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${props => props.theme.spacing.md};
`;

const Title = styled.h2`
    color: ${props => props.theme.colors.primary};
    margin: 0;
`;

const Button = styled.button`
    background: ${props => props.theme.colors.surface};
    color: ${props => props.theme.colors.primary};
    border: 1px solid ${props => props.theme.colors.border};
    padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${props => props.theme.spacing.sm};
    
    &:hover {
        background: ${props => props.theme.colors.border};
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const DirectoryList = styled.div`
    display: grid;
    gap: ${props => props.theme.spacing.md};
`;

const DirectoryItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${props => props.theme.spacing.md};
    background: ${props => props.theme.colors.background};
    border-radius: 4px;
    border: 1px solid ${props => props.theme.colors.border};
`;

const DirectoryInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${props => props.theme.spacing.md};
    
    svg {
        color: ${props => props.theme.colors.secondary};
    }
`;

const DirectoryName = styled.div`
    color: ${props => props.theme.colors.primary};
    font-weight: ${props => props.theme.fontWeight.medium};
`;

const DirectoryPath = styled.div`
    color: ${props => props.theme.colors.secondary};
    font-size: ${props => props.theme.fontSizes.sm.base};
`;

const LastScanned = styled.div`
    color: ${props => props.theme.colors.secondary};
    font-size: ${props => props.theme.fontSizes.sm.base};
`;

const Actions = styled.div`
    display: flex;
    gap: ${props => props.theme.spacing.sm};
`;

const DirectoryManager = ({ onScanComplete }) => {
    const [directories, setDirectories] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newPath, setNewPath] = useState('');
    
    // Fetch directories on mount
    useEffect(() => {
        fetchDirectories();
    }, []);
    
    const fetchDirectories = async () => {
        try {
            const response = await fetch('/api/directories');
            const data = await response.json();
            setDirectories(data);
        } catch (error) {
            console.error('Error fetching directories:', error);
        }
    };
    
    const handleAddDirectory = async () => {
        try {
            setIsAdding(true);
            const response = await fetch('/api/directories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: newPath })
            });
            
            if (!response.ok) throw new Error('Failed to add directory');
            
            await fetchDirectories();
            setNewPath('');
            onScanComplete?.();
        } catch (error) {
            console.error('Error adding directory:', error);
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleRemoveDirectory = async (id) => {
        try {
            const response = await fetch(`/api/directories/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to remove directory');
            
            await fetchDirectories();
        } catch (error) {
            console.error('Error removing directory:', error);
        }
    };
    
    const handleScanAll = async () => {
        try {
            setIsScanning(true);
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) throw new Error('Failed to scan directories');
            
            const result = await response.json();
            console.log('Scan complete:', result);
            onScanComplete?.();
            await fetchDirectories();
        } catch (error) {
            console.error('Error scanning directories:', error);
        } finally {
            setIsScanning(false);
        }
    };
    
    const handleScanDirectory = async (id) => {
        try {
            setIsScanning(true);
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory_id: id })
            });
            
            if (!response.ok) throw new Error('Failed to scan directory');
            
            const result = await response.json();
            console.log('Directory scan complete:', result);
            onScanComplete?.();
            await fetchDirectories();
        } catch (error) {
            console.error('Error scanning directory:', error);
        } finally {
            setIsScanning(false);
        }
    };
    
    return (
        <Container>
            <Header>
                <Title>Media Directories</Title>
                <Button onClick={handleScanAll} disabled={isScanning}>
                    <FaSync /> Scan All
                </Button>
            </Header>
            
            <DirectoryList>
                {directories.map(dir => (
                    <DirectoryItem key={dir.id}>
                        <DirectoryInfo>
                            <FaFolder />
                            <div>
                                <DirectoryName>{dir.name}</DirectoryName>
                                <DirectoryPath>{dir.path}</DirectoryPath>
                            </div>
                        </DirectoryInfo>
                        <div>
                            <LastScanned>
                                Last scanned: {dir.last_scanned ? new Date(dir.last_scanned).toLocaleString() : 'Never'}
                            </LastScanned>
                            <Actions>
                                <Button onClick={() => handleScanDirectory(dir.id)} disabled={isScanning}>
                                    <FaSync />
                                </Button>
                                <Button onClick={() => handleRemoveDirectory(dir.id)}>
                                    <FaTrash />
                                </Button>
                            </Actions>
                        </div>
                    </DirectoryItem>
                ))}
            </DirectoryList>
            
            <div style={{ marginTop: '1rem' }}>
                <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="Enter directory path"
                    style={{ marginRight: '0.5rem' }}
                />
                <Button onClick={handleAddDirectory} disabled={isAdding || !newPath}>
                    Add Directory
                </Button>
            </div>
        </Container>
    );
};

export default DirectoryManager; 