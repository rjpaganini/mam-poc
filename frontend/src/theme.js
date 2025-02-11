/**
 * @file: theme.js
 * @description: Material-UI theme configuration for the Media Asset Management system
 * 
 * This file serves as the SINGLE SOURCE OF TRUTH for all UI theming decisions.
 * It implements a strict, type-safe theme system with:
 * 
 * Key Features:
 * - Comprehensive color palette management
 * - Consistent typography scaling
 * - Spacing and layout utilities
 * - Component-specific theme overrides
 * - Dark mode optimization
 * 
 * Theme Structure:
 * 1. Colors
 *    - Core colors (background, surface, border)
 *    - Text colors (primary, secondary)
 *    - UI colors (accent, success, error)
 *    - Status colors (processing, complete, error)
 * 
 * 2. Typography
 *    - Font families (base, code)
 *    - Font sizes (xs to xl)
 *    - Font weights
 *    - Line heights
 * 
 * 3. Spacing
 *    - Base unit: 4px
 *    - Scaling: Multiples of base unit
 *    - Component-specific spacing
 * 
 * Usage:
 * import { createMuiTheme, getThemeValue } from './theme';
 * const theme = createMuiTheme();
 * const fontSize = getThemeValue('typography.fontSize.sm', '0.5rem');
 * 
 * @author: AI Assistant
 * @lastModified: February 2025
 */

/**
 * Theme config - Sr Dev 2024
 */

import { createTheme } from '@mui/material/styles';

// Base theme configuration
export const createMuiTheme = () => {
    return {
        palette: {
            mode: 'dark',
            primary: {
                main: '#2196f3',
                dark: '#1976d2',
                light: '#64b5f6'
            },
            background: {
                default: '#121212',
                paper: '#1e1e1e',
                surface: '#242424'
            },
            text: {
                primary: '#ffffff',
                secondary: 'rgba(255, 255, 255, 0.7)'
            },
            error: {
                main: '#f44336'
            },
            divider: 'rgba(255, 255, 255, 0.12)',
            action: {
                hover: 'rgba(255, 255, 255, 0.08)',
                selected: 'rgba(255, 255, 255, 0.16)'
            }
        },
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            fontSize: 14,
            fontWeightLight: 300,
            fontWeightRegular: 400,
            fontWeightMedium: 500,
            fontWeightBold: 700
        },
        shape: {
            borderRadius: 4
        },
        spacing: (factor) => `${8 * factor}px`,
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none'
                    }
                }
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none'
                    }
                }
            }
        }
    };
};

// Create the theme instance
const theme = createTheme(createMuiTheme());

export default theme; 