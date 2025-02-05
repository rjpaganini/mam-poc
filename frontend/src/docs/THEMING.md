# UI & Theming Guide

## Theme Hierarchy

```
theme.js (base) → config.js (overrides) → component styles → inline styles
```

## Font Size System

```javascript
// Base font sizes - Use these as source of truth
typography: {
    fontSize: {
        xs: '0.425rem',   // 7px  - Metadata labels
        sm: '0.5rem',     // 8px  - Metadata values
        md: '0.563rem',   // 9px  - General text
        lg: '0.625rem',   // 10px - Headings
        xl: '0.75rem',    // 12px - Large headings
        logo: '0.4rem'    // Logo specific
    }
}
```

## Key Insights

1. **Font Size Control**
   - Use `!important` for critical sizes that must not be overridden
   - Example: `fontSize: '0.7rem !important'`
   - Avoid using raw pixel values

2. **Component Height Standards**
   - Controls (buttons, inputs): 24px height
   - Padding: Use multiples of 4px (0.25rem)
   - Line height: 1 for metadata, 1.2 for titles

3. **Color System**
   ```javascript
   colors: {
       background: '#000000',  // Base background
       surface: '#111111',     // Card/modal background
       border: '#222222',      // Default borders
       hover: '#FF0000',       // Hover states
       accent: '#FF0000',      // Active states
       text: {
           primary: '#FFFFFF',
           secondary: '#999999'
       }
   }
   ```

## Common Pitfalls

1. **❌ Don't**
   - Mix pixel and rem units
   - Use hardcoded colors
   - Override theme values directly
   - Use different heights for similar controls

2. **✅ Do**
   - Use theme variables: `theme => theme.typography.fontSize.sm`
   - Apply consistent padding: `px: 1.5, py: 0.5`
   - Match control heights: `height: '24px'`
   - Use opacity for variations: `opacity: 0.7`

## Quick Reference

```javascript
// Standard control styling
const controlStyle = {
    height: '24px',
    fontSize: '0.7rem',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: '1px solid',
    borderRadius: theme.radius.sm
}

// Active state
const activeStyle = {
    borderColor: theme.colors.accent
}

// Metadata styling
const metadataStyle = {
    fontSize: '0.4rem !important',
    lineHeight: 1,
    gap: '1px'
}
```

## Theme Update Process

1. Update base values in `theme.js`
2. Check component-specific overrides
3. Test in all view modes (grid/list)
4. Verify responsive behavior
5. Check active/hover states

## Common Components

- **Buttons**: 24px height, 0.7rem font
- **Inputs**: 24px height, 0.7rem font
- **Metadata**: 0.4rem font, lineHeight 1
- **Titles**: 0.7rem font, lineHeight 1.2
- **Toggles**: 24px height, red border for active

## Best Practices

1. **Consistency**
   - Use theme values exclusively
   - Match heights across controls
   - Maintain padding ratios

2. **Performance**
   - Use `useMemo` for computed styles
   - Avoid runtime theme modifications
   - Cache theme values when possible

3. **Maintenance**
   - Document any theme overrides
   - Use semantic naming
   - Keep style objects separate

## Testing Theme Changes

```javascript
// Debug helper
const logThemeValues = (component, styles) => {
    console.log(`[Theme Debug] ${component}:`, {
        fontSize: styles.fontSize,
        height: styles.height,
        padding: `${styles.paddingTop}/${styles.paddingRight}`,
        computed: window.getComputedStyle(element)
    });
};
``` 