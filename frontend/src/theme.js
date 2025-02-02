// Theme configuration for the application
const theme = {
    colors: {
        // Background colors
        background: '#000000',
        surface: '#111111',
        border: '#333333',
        
        // Text colors
        primary: '#ffffff',
        secondary: '#888888',
        disabled: '#666666',
        valnio: '#FF1493', // Hot pink for valn.io text
        
        // Status colors
        success: '#4CAF50',
        warning: '#FFC107',
        error: '#F44336'
    },
    
    // Font sizes for different screen sizes
    fontSizes: {
        xs: {
            base: '12px',
            heading: '16px'
        },
        sm: {
            base: '14px',
            heading: '18px'
        },
        md: {
            base: '16px',
            heading: '20px'
        },
        lg: {
            base: '18px',
            heading: '24px'
        }
    },
    
    // Spacing units
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '32px',
        xl: '64px'
    },
    
    // Font weights
    fontWeight: {
        normal: 400,
        medium: 500,
        bold: 700
    }
};

export default theme; 