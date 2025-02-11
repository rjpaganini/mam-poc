/**
 * error.js - Minimal error handling
 * Sr Dev - 2024
 */

// Core error types
const E = {
    API: 'api_error',
    AUTH: 'auth_error',
    NET: 'network_error',
    DATA: 'data_error'
};

// Error handler with minimal token usage
class Err {
    static handle(e, ctx = '') {
        const err = {
            type: this._getType(e),
            msg: e.message,
            ctx,
            ts: Date.now()
        };
        
        console.error(`[${err.type}] ${ctx}: ${err.msg}`);
        return err;
    }
    
    static _getType(e) {
        if (e.status) return E.API;
        if (e.name === 'TypeError') return E.NET;
        if (e.name === 'SyntaxError') return E.DATA;
        return 'error';
    }
    
    static isApiError(e) {
        return e?.type === E.API;
    }
    
    static isNetError(e) {
        return e?.type === E.NET;
    }
}

export { E, Err }; 