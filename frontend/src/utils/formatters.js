/**
 * Utility functions for formatting values in a consistent way across the application
 */

/**
 * Formats a byte size into a human readable string in megabytes
 * @param {number} size - Size in bytes or megabytes
 * @returns {string} Formatted string in MB
 */
export const formatFileSize = (size) => {
    // Handle invalid input
    if (size === null || size === undefined || isNaN(size)) return '-';
    
    // Ensure we're working with a number
    const numericSize = typeof size === 'number' ? size : parseFloat(size);
    if (isNaN(numericSize)) return '-';
    
    // If size is already small (likely in MB), use it directly
    // Otherwise convert from bytes to MB
    const megabytes = numericSize < 1000 ? 
        numericSize : 
        numericSize / (1024 * 1024);
    
    // Format with appropriate precision
    return `${megabytes.toFixed(1)} MB`;
};

/**
 * Formats a date in a consistent way
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Format duration to timecode format (HH:MM:SS)
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '-';
    
    const totalSeconds = parseFloat(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Format FPS to consistent decimal places
 * @param {number} fps - Frames per second
 * @returns {string} Formatted FPS string
 */
export const formatFPS = (fps) => {
    if (!fps || isNaN(fps)) return '-';
    return Number(fps).toFixed(2);
};

/**
 * Format bitrate to Mbps
 * @param {number} bitrate - Bitrate in bits per second
 * @returns {string} Formatted bitrate string
 */
export const formatBitrate = (bitrate) => {
    if (!bitrate || isNaN(bitrate)) return '-';
    const mbps = (parseInt(bitrate, 10) / 1000000).toFixed(1);
    return `${mbps} Mbps`;
}; 