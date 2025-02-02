/**
 * Utility functions for formatting values in a consistent way across the application
 */

/**
 * Formats a byte size into a human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string with appropriate unit (B, KB, MB, GB)
 */
export const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
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