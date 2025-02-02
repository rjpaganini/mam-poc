import config from '../config';

// Utility function to open folder in Finder
export const openFolder = async (path) => {
    try {
        // Debug log
        console.log('Opening folder for path:', path);
        
        // Call backend endpoint to open folder
        const response = await fetch(`${config.api.baseURL}/api/v1/open-folder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to open folder');
        }
        
        console.log('Folder opened successfully:', data.path);
    } catch (error) {
        console.error('Error opening folder:', error);
        alert('Could not open folder location. Please check the file path.');
    }
}; 