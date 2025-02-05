/**
 * @file theme.js
 * Central theme configuration with strict typing and fallbacks
 * This is the SINGLE SOURCE OF TRUTH for all UI theming
 */

// Base theme values - NEVER access these directly from components
const baseTheme = {
    colors: {
        // Core colors
        background: '#000000',
        surface: '#111111',
        border: '#222222',
        hover: '#FF0000',
        
        // Text colors
        text: {
            primary: '#FFFFFF',
            secondary: '#999999'
        },
        
        // UI colors
        primary: '#000000',  // Changed to black for buttons
        accent: '#FF0000',
        success: '#00FF00',
        error: '#FF0000'
    },
    
    typography: {
        // Font families
        fontFamily: {
            base: 'Menlo, Monaco, "Courier New", monospace',
            code: 'Menlo, Monaco, "Courier New", monospace'
        },
        // Font weights
        fontWeight: {
            normal: 400,
            medium: 500,
            bold: 600
        },
        // Font sizes - Aggressively reduced
        fontSize: {
            xs: '0.425rem',   // ~7px - Metadata labels
            sm: '0.5rem',     // 8px - Metadata values
            md: '0.563rem',   // 9px - General text
            lg: '0.625rem',   // 10px - Headings
            xl: '0.75rem',    // 12px - Large headings
            logo: '0.4rem'    // Special size for logo (50% reduction)
        }
    },
    
    // Spacing scale
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '32px',
        xl: '64px'
    },
    
    // Border radius scale
    radius: {
        sm: '2px',
        md: '4px',
        lg: '6px'
    }
};

/**
 * Safe theme getter with strict typing and fallbacks
 * @param {string} path - Dot notation path to theme value
 * @param {any} fallback - Fallback value if path doesn't exist
 * @returns {any} Theme value or fallback
 */
export const getThemeValue = (path, fallback) => {
    try {
        const value = path.split('.').reduce((obj, key) => obj[key], baseTheme);
        return value ?? fallback;
    } catch (e) {
        console.warn(`Theme value not found: ${path}, using fallback`, { fallback });
        return fallback;
    }
};

/**
 * Material-UI theme configuration
 * Transforms our base theme into MUI format
 */
export const createMuiTheme = () => ({
    palette: {
        mode: 'dark',
        primary: {
            main: baseTheme.colors.primary,
            dark: baseTheme.colors.accent, // Red for hover states
        },
        background: {
            default: baseTheme.colors.background,
            paper: baseTheme.colors.surface,
        },
        text: {
            primary: baseTheme.colors.text.primary,
            secondary: baseTheme.colors.text.secondary,
        },
        error: {
            main: baseTheme.colors.error
        },
        success: {
            main: baseTheme.colors.success
        },
        action: {
            hover: baseTheme.colors.hover
        }
    },
    typography: {
        fontFamily: baseTheme.typography.fontFamily.base,
        fontSize: 12, // Base font size reduced
        fontWeightLight: baseTheme.typography.fontWeight.normal,
        fontWeightRegular: baseTheme.typography.fontWeight.normal,
        fontWeightMedium: baseTheme.typography.fontWeight.medium,
        fontWeightBold: baseTheme.typography.fontWeight.bold,
        // Apply base font to all variants
        allVariants: {
            fontFamily: baseTheme.typography.fontFamily.base
        }
    },
    components: {
        // Button overrides
        MuiButton: {
            styleOverrides: {
                root: {
                    borderColor: baseTheme.colors.text.primary,
                    '&:hover': {
                        borderColor: baseTheme.colors.accent
                    }
                }
            }
        },
        MuiCssBaseline: {
            styleOverrides: {
                '*': {
                    fontFamily: baseTheme.typography.fontFamily.base
                }
            }
        }
    }
});

// Export the base theme for direct value access
export default baseTheme; 