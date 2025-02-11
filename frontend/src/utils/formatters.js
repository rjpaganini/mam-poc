/**
 * Core formatters for consistent value display
 */

/**
 * Formats a byte size into a human readable string in megabytes
 * @param {number} size - Size in bytes or megabytes
 * @returns {string} Formatted string in MB
 */
export const formatFileSize = size => {
    if (!size || isNaN(size)) return '-';
    const mb = size < 1000 ? size : size / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
};

/**
 * Formats a date in a consistent way
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = date => {
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
export const formatDuration = secs => {
    if (!secs || isNaN(secs)) return '-';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0 ? 
        `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` :
        `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format FPS to consistent decimal places
 * @param {number} fps - Frames per second
 * @returns {string} Formatted FPS string
 */
export const formatFPS = fps => !fps || isNaN(fps) ? '-' : Number(fps).toFixed(2);

/**
 * Format bitrate to Mbps
 * @param {number} bitrate - Bitrate in bits per second
 * @returns {string} Formatted bitrate string
 */
export const formatBitrate = rate => {
    if (!rate || isNaN(rate)) return '-';
    return `${(parseInt(rate, 10) / 1000000).toFixed(1)} Mbps`;
}; 