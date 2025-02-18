import config from '../config';

// Open folder in system file explorer
export const openFolder = async path => {
    if (!path) {
        console.error('No file path provided');
        alert('Could not open folder: No file path provided');
        return;
    }

    try {
        // Remove the 'media/' prefix if it exists
        const cleanPath = path.replace(/^media\//, '');
        
        // Get the absolute path by joining with the media root path
        const absolutePath = `/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos/${cleanPath}`;
        
        console.log('Attempting to open folder for file:', absolutePath);
        
        // Use the exposed Electron API
        if (!window.electron) {
            throw new Error('Electron API not available');
        }
        
        const result = await window.electron.openFolder(absolutePath);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to open folder');
        }
        
        console.log('Folder opened successfully:', absolutePath);
    } catch (err) {
        console.error('Error opening folder:', err);
        
        // Provide more specific error messages to the user
        let errorMessage = 'Could not open folder location';
        if (err.message.includes('not available')) {
            errorMessage = 'Application error: Please ensure you are running in Electron';
        } else if (err.message.includes('ENOENT')) {
            errorMessage = 'Folder not found: The file location may have changed';
        }
        
        alert(errorMessage);
    }
}; 