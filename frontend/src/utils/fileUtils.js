import config from '../config';

// Open folder in system file explorer
export const openFolder = async path => {
    try {
        const res = await fetch(`${config.api.baseURL}/api/v1/open-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to open folder');
        
        console.log('Folder opened:', data.path);
    } catch (err) {
        console.error('Error opening folder:', err);
        alert('Could not open folder location');
    }
}; 