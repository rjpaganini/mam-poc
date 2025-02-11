/**
 * Theme debug tools - DEV only
 */

import logger from '../services/logger';

// Debug levels
const LEVELS = { ERR: 'error', WARN: 'warn', INFO: 'info' };

// UI elements to validate
const ELEMENTS = {
    ctrl: {
        sel: ['button', 'input', 'select'],
        height: '24px',
        fontSize: '0.7rem'
    },
    meta: {
        sel: ['.metadataItem', '.metadataLabel', '.metadataValue'],
        fontSize: '0.4rem',
        lineHeight: '1'
    },
    title: {
        sel: ['.title', 'h1', 'h2', 'h3'],
        lineHeight: '1.2'
    }
};

// Log theme info in dev
export const debugTheme = theme => {
    if (process.env.NODE_ENV !== 'development') return;

    logger.info('Theme Debug:', {
        palette: {
            mode: theme.palette.mode,
            bg: theme.palette.background,
            text: theme.palette.text,
            primary: theme.palette.primary
        },
        typography: {
            font: theme.typography.fontFamily,
            size: theme.typography.fontSize,
            weights: theme.typography.fontWeightMedium
        },
        spacing: theme.spacing(1),
        shape: theme.shape
    });
};

// Validate element styles
const validateStyles = (el, expected) => {
    const style = window.getComputedStyle(el);
    return Object.entries(expected).map(([prop, exp]) => {
        const act = style[prop];
        return act !== exp ? {
            el: el.tagName.toLowerCase(),
            class: el.className,
            prop, exp, act,
            level: LEVELS.WARN
        } : null;
    }).filter(Boolean);
};

// Verify theme application
export const verifyTheme = theme => {
    if (process.env.NODE_ENV !== 'development') return;

    const issues = [];

    // Check elements
    Object.entries(ELEMENTS).forEach(([group, cfg]) => {
        cfg.sel.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                issues.push(...validateStyles(el, {
                    height: cfg.height,
                    fontSize: cfg.fontSize,
                    lineHeight: cfg.lineHeight
                }));
            });
        });
    });

    // Log results
    if (issues.length) {
        logger.warn('Theme Issues:', {
            count: issues.length,
            issues: issues.map(i => ({
                ...i,
                fix: getFix(i)
            }))
        });
    } else {
        logger.info('Theme Valid');
    }
};

// Get fix suggestion
const getFix = ({ prop }) => ({
    height: 'Use 24px',
    fontSize: 'Use theme.typography.fontSize',
    lineHeight: 'Use 1 for meta, 1.2 for titles'
})[prop] || 'See THEMING.md';

// Monitor theme changes
export const monitorThemeChanges = theme => {
    debugTheme(theme);
    
    setTimeout(() => verifyTheme(theme), 0);

    const observer = new MutationObserver(() => verifyTheme(theme));
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    return process.env.NODE_ENV === 'development' ? 
        () => observer.disconnect() : undefined;
}; 