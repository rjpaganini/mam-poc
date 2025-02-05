# Frontend Development Guide

> 📘 **Note**: This is the detailed frontend development documentation. For a quick overview, see [../../frontend/README.md](../../frontend/README.md)

## Quick Start

```bash
cd frontend
npm install
npm start  # Runs on port 3001
```

## Development Server

The development server runs on http://localhost:3001 (not the default React port 3000).
This is intentional to avoid conflicts with other development servers.

### Important Ports
- Frontend: http://localhost:3001
- Backend API: http://localhost:5001
- WebSocket: ws://localhost:5001/ws

## Available Scripts

### Development
- `npm start`: Run development server on http://localhost:3000
- `npm test`: Run test suite
- `npm run build`: Create production build

## Project Structure

```
frontend/
├── src/
│   ├── components/     # React components
│   │   ├── MediaLibrary/  # Media browsing components
│   │   ├── AssetDetails/  # Asset detail view
│   │   └── common/        # Shared components
│   ├── services/      # API services
│   │   ├── api.js       # REST API client
│   │   └── websocket.js # WebSocket client
│   ├── utils/         # Utility functions
│   │   └── formatters.js # Value formatters
│   └── pages/         # Page components
├── public/            # Static assets
└── build/            # Production build output
```

## Development Guidelines

1. Component Organization
   - Use functional components with hooks
   - Keep components small and focused
   - Use proper TypeScript types

2. State Management
   - Use React Context for global state
   - Keep component state local when possible
   - Implement proper error boundaries

3. Performance
   - Implement proper lazy loading
   - Use React.memo for expensive renders
   - Optimize media loading strategies

4. Testing
   - Write unit tests for utilities
   - Use React Testing Library
   - Test error scenarios

## Build & Deployment

The production build process:
1. Runs type checking
2. Bundles and minifies code
3. Optimizes assets
4. Generates sourcemaps

## Troubleshooting

Common issues and solutions:
1. Build failures
   - Clear node_modules and reinstall
   - Check TypeScript errors
   - Verify environment variables

2. Performance issues
   - Check bundle size
   - Implement code splitting
   - Optimize media loading

## Additional Resources

- [React Documentation](https://reactjs.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Testing Library Docs](https://testing-library.com/docs/)

## Data Formatting

### File Size Display
```javascript
// Intelligent size formatting
const formatFileSize = (size) => {
    if (size === null || size === undefined || isNaN(size)) return '-';
    const numericSize = typeof size === 'number' ? size : parseFloat(size);
    const megabytes = numericSize < 1000 ? numericSize : numericSize / (1024 * 1024);
    return `${megabytes.toFixed(1)} MB`;
};
```

### Best Practices
- Use centralized formatters from `utils/formatters.js`
- Handle edge cases (null, undefined, NaN)
- Maintain consistent display units
- Consider sorting implications for numeric values

## Component Optimization

### AssetCard
- Implement proper error boundaries
- Use memoization for expensive operations
- Handle WebSocket cleanup on unmount
- Maintain consistent metadata display

### ListView
- Fixed column widths for stability
- Proper numeric sorting for file sizes
- Consistent formatter usage
- Error state handling
