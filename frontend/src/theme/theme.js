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
const colors = {
    background: '#000000',
    surface: '#111111',
    border: '#222222',
    hover: '#FF0000',
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
            borderColor: colors.hover
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
        }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: parseInt(fontSizes.md),
        fontSizes // Make font sizes available in theme
    },
    spacing: spacing.base,
    shape: {
        borderRadius: 2
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: componentStyles.controls
            }
        },
        MuiInputBase: {
            styleOverrides: {
                root: componentStyles.controls
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: colors.surface,
                    borderColor: colors.border
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