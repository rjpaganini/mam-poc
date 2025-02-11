"""
Minimal logging - Sr Dev 2024
"""

import logging
import json
import os
from datetime import datetime
from flask import request, has_request_context
from functools import wraps

class LogFmt(logging.Formatter):
    """JSON formatter"""
    
    def format(self, r):
        """Format with minimal data"""
        d = {
            't': self.formatTime(r),
            'l': r.levelname[0],
            'm': r.getMessage(),
            's': r.name.split('.')[-1]
        }
        
        if has_request_context():
            d.update({
                'i': request.remote_addr,
                'p': request.path
            })
        
        if r.exc_info:
            d['e'] = {
                't': r.exc_info[0].__name__,
                'm': str(r.exc_info[1])
            }
        
        return json.dumps(d)

def setup_log(app=None):
    """Quick setup"""
    h = logging.StreamHandler()
    h.setFormatter(LogFmt())
    
    root = logging.getLogger()
    root.addHandler(h)
    root.setLevel(logging.DEBUG if app and app.debug else logging.INFO)

def log_err(e: Exception, ctx: str = None):
    """Error helper"""
    logging.error(f"{ctx or 'Error'}: {str(e)}", exc_info=e)

def trace(f):
    """Trace helper"""
    @wraps(f)
    def wrap(*a, **k):
        t = datetime.now()
        try:
            return f(*a, **k)
        except Exception as e:
            log_err(e, f.__name__)
            raise
        finally:
            d = (datetime.now() - t).total_seconds()
            logging.debug(f"{f.__name__}: {d:.3f}s")
    return wrap 