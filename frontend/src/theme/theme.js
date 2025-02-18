/**
 * Theme Configuration
 * Single source of truth for all theme-related values
 */

import { createTheme } from '@mui/material/styles';

/**
 * Base font sizes for the application
 * Use these values as the source of truth for component styling
 */
const fontSizes = {
    xs: '0.425rem',    // 7px  - Metadata labels
    sm: '0.5rem',      // 8px  - Metadata values
    md: '0.563rem',    // 9px  - General text
    lg: '0.625rem',    // 10px - Headings
    xl: '0.75rem',     // 12px - Large headings
    logo: '0.4rem'     // Logo specific
};

/**
 * Spacing units
 * All spacing should be a multiple of the base unit
 */
const spacing = {
    base: 4, // 4px base unit
    get xs() { return `${this.base * 1}px`; },    // 4px
    get sm() { return `${this.base * 2}px`; },    // 8px
    get md() { return `${this.base * 3}px`; },    // 12px
    get lg() { return `${this.base * 4}px`; },    // 16px
    get xl() { return `${this.base * 5}px`; }     // 20px
};

/**
 * Color palette
 * Use these values for all color references
 */
export const colors = {
    background: '#000000',
    surface: '#111111',
    border: '#222222',
    hover: '#660000',  // Brighter red for hover
    accent: '#FF0000',
    text: {
        primary: '#FFFFFF',
        secondary: '#999999'
    }
};

/**
 * Component-specific styles
 * Reusable style configurations for common components
 */
export const componentStyles = {
    controls: {
        height: '24px',
        fontSize: fontSizes.md,
        padding: `${spacing.xs} ${spacing.sm}`,
        backgroundColor: 'transparent',
        border: `1px solid ${colors.border}`,
        borderRadius: '2px',
        '&:hover': {
            borderColor: colors.hover,
            backgroundColor: colors.hover
        },
        '&.active': {
            borderColor: colors.accent
        }
    },
    metadata: {
        fontSize: `${fontSizes.xs} !important`,
        lineHeight: 1,
        color: colors.text.secondary,
        gap: spacing.xs
    },
    title: {
        fontSize: fontSizes.lg,
        lineHeight: 1.2,
        color: colors.text.primary
    }
};

// Define the base font family to be used throughout the app
const baseFontFamily = '"Menlo", monospace';

/**
 * Create the base theme
 * Extend with component-specific overrides
 */
const theme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: colors.background,
            paper: colors.surface
        },
        text: colors.text,
        primary: {
            main: colors.accent
        },
        action: {
            hover: colors.hover
        }
    },
    typography: {
        fontFamily: baseFontFamily,
        fontSize: parseInt(fontSizes.md),
        fontSizes,
        // Add specific typography variants
        h1: { fontFamily: baseFontFamily },
        h2: { fontFamily: baseFontFamily },
        h3: { fontFamily: baseFontFamily },
        h4: { fontFamily: baseFontFamily },
        h5: { fontFamily: baseFontFamily },
        h6: { fontFamily: baseFontFamily },
        body1: { fontFamily: baseFontFamily },
        body2: { fontFamily: baseFontFamily },
        button: { 
            fontFamily: baseFontFamily,
            textTransform: 'none'
        },
        caption: { fontFamily: baseFontFamily },
        overline: { fontFamily: baseFontFamily }
    },
    spacing: spacing.base,
    shape: {
        borderRadius: 2
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                '@global': {
                    '*': {
                        fontFamily: baseFontFamily
                    },
                    body: {
                        fontFamily: baseFontFamily
                    }
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    ...componentStyles.controls,
                    fontFamily: baseFontFamily
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontFamily: baseFontFamily
                }
            }
        },
        // Add hover styles for list items
        MuiListItem: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: colors.hover,
                        '& *': { color: '#ffffff' }
                    }
                }
            }
        },
        // Global input styles
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${colors.accent} !important`,
                        borderWidth: '2px'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.hover
                    },
                    // Override the default focus visible outline
                    '&.Mui-focusVisible': {
                        outline: 'none',
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: `${colors.accent} !important`,
                            borderWidth: '2px'
                        }
                    }
                }
            }
        },
        // Global TextField styles
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${colors.accent} !important`
                    }
                }
            }
        },
        // Global input base styles
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontFamily: baseFontFamily,
                    '&.Mui-focused': {
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: `${colors.accent} !important`
                        }
                    }
                }
            }
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${colors.accent} !important`,
                        borderWidth: '2px'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.hover
                    }
                }
            }
        }
    }
});

/**
 * Theme utilities
 * Helper functions for working with theme values
 */
export const themeUtils = {
    /**
     * Get a font size with !important flag
     * @param {string} size - Size key from fontSizes
     * @returns {string} Font size with !important
     */
    getFontSize: (size) => `${fontSizes[size]} !important`,

    /**
     * Get a spacing value
     * @param {number} multiplier - Multiple of base spacing
     * @returns {string} Spacing value in pixels
     */
    getSpacing: (multiplier) => `${spacing.base * multiplier}px`,

    /**
     * Get a color with optional opacity
     * @param {string} path - Dot notation path to color
     * @param {number} opacity - Optional opacity value
     * @returns {string} Color value
     */
    getColor: (path, opacity) => {
        const color = path.split('.').reduce((obj, key) => obj[key], colors);
        return opacity !== undefined ? `${color}${Math.floor(opacity * 255).toString(16)}` : color;
    }
};

export default theme; 