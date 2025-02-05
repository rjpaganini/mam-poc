/**
 * Theme debugging utilities
 * Comprehensive tools for tracking and validating theme application
 */

import logger from '../services/logger';

/**
 * Debug levels for theme validation
 */
const DEBUG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info'
};

/**
 * Critical UI elements to validate
 */
const CRITICAL_ELEMENTS = {
    controls: {
        selectors: ['button', 'input', 'select'],
        expectedHeight: '24px',
        expectedFontSize: '0.7rem'
    },
    metadata: {
        selectors: ['.metadataItem', '.metadataLabel', '.metadataValue'],
        expectedFontSize: '0.4rem',
        expectedLineHeight: '1'
    },
    titles: {
        selectors: ['.title', 'h1', 'h2', 'h3'],
        expectedLineHeight: '1.2'
    }
};

/**
 * Detailed theme information logger
 * @param {Object} theme - The theme object to debug
 */
export const debugTheme = (theme) => {
    if (process.env.NODE_ENV !== 'development') return;

    logger.info('Theme Debug Information:', {
        palette: {
            mode: theme.palette.mode,
            background: theme.palette.background,
            text: theme.palette.text,
            primary: theme.palette.primary,
            error: theme.palette.error,
            success: theme.palette.success
        },
        typography: {
            fontFamily: theme.typography.fontFamily,
            fontSize: theme.typography.fontSize,
            fontWeights: {
                light: theme.typography.fontWeightLight,
                regular: theme.typography.fontWeightRegular,
                medium: theme.typography.fontWeightMedium,
                bold: theme.typography.fontWeightBold
            }
        },
        spacing: theme.spacing(1),
        shape: theme.shape,
        timestamp: new Date().toISOString()
    });
};

/**
 * Validates computed styles against theme specifications
 * @param {Element} element - DOM element to validate
 * @param {Object} expectedStyles - Expected style values
 * @returns {Array} Array of validation issues
 */
const validateElementStyles = (element, expectedStyles) => {
    const computedStyle = window.getComputedStyle(element);
    const issues = [];

    Object.entries(expectedStyles).forEach(([property, expectedValue]) => {
        const actualValue = computedStyle[property];
        if (actualValue !== expectedValue) {
            issues.push({
                element: element.tagName.toLowerCase(),
                class: element.className,
                property,
                expected: expectedValue,
                actual: actualValue,
                level: DEBUG_LEVELS.WARN
            });
        }
    });

    return issues;
};

/**
 * Verifies theme application to DOM
 * @param {Object} theme - Current theme object
 */
export const verifyThemeApplication = (theme) => {
    if (process.env.NODE_ENV !== 'development') return;

    const issues = [];

    // Check critical UI elements
    Object.entries(CRITICAL_ELEMENTS).forEach(([group, config]) => {
        config.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const elementIssues = validateElementStyles(element, {
                    height: config.expectedHeight,
                    fontSize: config.expectedFontSize,
                    lineHeight: config.expectedLineHeight
                });
                issues.push(...elementIssues);
            });
        });
    });

    // Log validation results
    if (issues.length > 0) {
        logger.warn('Theme Validation Issues:', {
            timestamp: new Date().toISOString(),
            issueCount: issues.length,
            issues: issues.map(issue => ({
                ...issue,
                suggestion: getSuggestion(issue)
            }))
        });
    } else {
        logger.info('Theme Validation Passed:', {
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Provides suggestions for fixing theme issues
 * @param {Object} issue - The theme validation issue
 * @returns {string} Suggestion for fixing the issue
 */
const getSuggestion = (issue) => {
    const suggestions = {
        height: 'Use height: "24px" for consistent control sizing',
        fontSize: 'Use theme.typography.fontSize values with !important when needed',
        lineHeight: 'Use 1 for metadata, 1.2 for titles',
        color: 'Use theme.colors values instead of hardcoded colors',
        padding: 'Use multiples of 4px (0.25rem) for padding'
    };

    return suggestions[issue.property] || 'Refer to THEMING.md for guidance';
};

/**
 * Monitors theme changes and validates application
 * @param {Object} theme - Current theme object
 */
export const monitorThemeChanges = (theme) => {
    debugTheme(theme);
    
    // Validate theme application after DOM updates
    setTimeout(() => {
        verifyThemeApplication(theme);
    }, 0);

    // Set up mutation observer for dynamic changes
    const observer = new MutationObserver(() => {
        verifyThemeApplication(theme);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    // Cleanup observer on development only
    if (process.env.NODE_ENV === 'development') {
        return () => observer.disconnect();
    }
}; 