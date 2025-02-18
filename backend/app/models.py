# backend/app/models.py
# Database models with proper indexing and relationships

from datetime import datetime
from sqlalchemy import event, Table, ForeignKey
from sqlalchemy.orm import validates
from sqlalchemy.exc import SQLAlchemyError
from pathlib import Path
from flask import current_app
from .database import db
from .config import Config
import os
from typing import Any, Dict, Optional

# Association table for many-to-many relationship between MediaAsset and Tag
asset_tags = Table('asset_tags', db.metadata,
    db.Column('asset_id', db.Integer, ForeignKey('media_assets.id', ondelete='CASCADE')),
    db.Column('tag_id', db.Integer, ForeignKey('tags.id', ondelete='CASCADE'))
)

class MediaDirectory(db.Model):
    """Model for tracking media directories."""
    __tablename__ = 'media_directories'
    
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(1024), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    last_scanned = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    @validates('path')
    def validate_path(self, key, path):
        """Ensure path exists and is a directory."""
        expanded_path = os.path.expanduser(path)
        if not os.path.exists(expanded_path):
            raise ValueError(f"Directory not found: {path}")
        if not os.path.isdir(expanded_path):
            raise ValueError(f"Not a directory: {path}")
        return expanded_path
    
    def to_dict(self):
        """Convert to API-friendly format."""
        return {
            'id': self.id,
            'path': self.path,
            'name': self.name,
            'is_active': self.is_active,
            'last_scanned': self.last_scanned.isoformat() if self.last_scanned else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Tag(db.Model):
    """Tag model for media asset organization."""
    __tablename__ = 'tags'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with assets - using back_populates
    assets = db.relationship('MediaAsset', secondary=asset_tags, back_populates='tags')
    
    @validates('name')
    def validate_name(self, key, name):
        """Ensure tag names are clean and unique."""
        if not name or not name.strip():
            raise ValueError("Tag name cannot be empty")
        return name.lower().strip()
    
    def to_dict(self):
        """Convert to API-friendly format."""
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class MediaAsset(db.Model):
    """Media asset model with enhanced metadata support"""
    __tablename__ = 'media_assets'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(1024), unique=True, nullable=False)
    file_size = db.Column(db.BigInteger)
    file_size_mb = db.Column(db.Float)
    format = db.Column(db.String(32))
    duration = db.Column(db.Float)
    duration_formatted = db.Column(db.String(32))
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    fps = db.Column(db.Float)
    codec = db.Column(db.String(32))
    container_format = db.Column(db.String(32))
    bit_rate = db.Column(db.Integer)
    audio_codec = db.Column(db.String(32))
    audio_channels = db.Column(db.Integer)
    audio_sample_rate = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships - using back_populates to match Tag model
    processing_results = db.relationship('ProcessingResult', backref='asset', lazy=True)
    tags = db.relationship('Tag', secondary='asset_tags', back_populates='assets', lazy=True)

    def __init__(self, **kwargs):
        """Initialize with proper type conversion"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)

    def get_absolute_path(self) -> Path:
        """Get absolute path to media file"""
        # If the path is already absolute and exists, use it
        path = Path(self.file_path)
        if path.is_absolute() and path.exists():
            return path
            
        # Otherwise, try relative to MEDIA_PATH
        media_path = Path(Config.MEDIA_PATH)
        # If the file_path starts with the media_path, make it relative
        if str(path).startswith(str(media_path)):
            path = Path(str(path).replace(str(media_path), '').lstrip('/'))
        return media_path / path

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with all fields"""
        # Get the relative path for display
        try:
            media_path = Path(Config.MEDIA_PATH)
            file_path = Path(self.file_path)
            if file_path.is_absolute():
                relative_path = str(file_path).replace(str(media_path), '').lstrip('/')
            else:
                relative_path = str(file_path)
        except Exception:
            relative_path = self.file_path

        return {
            'id': self.id,
            'title': self.title,
            'file_path': relative_path,  # Use relative path for frontend
            'file_size': self.file_size,
            'file_size_mb': self.file_size_mb,
            'format': self.format,
            'duration': float(self.duration) if self.duration else None,
            'duration_formatted': self.duration_formatted,
            'width': self.width,
            'height': self.height,
            'fps': self.fps,
            'codec': self.codec,
            'container_format': self.container_format,
            'bit_rate': self.bit_rate,
            'audio_codec': self.audio_codec,
            'audio_channels': self.audio_channels,
            'audio_sample_rate': self.audio_sample_rate,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

@event.listens_for(MediaAsset, 'before_insert')
def set_created_at(mapper, connection, target):
    """Set creation timestamp with error handling."""
    try:
        target.created_at = datetime.utcnow()
    except Exception as e:
        current_app.logger.error(f"Failed to set created_at: {e}")
        raise SQLAlchemyError("Failed to process timestamp") from e

@event.listens_for(MediaAsset, 'before_update')
def set_updated_at(mapper, connection, target):
    """Set update timestamp with error handling."""
    try:
        target.updated_at = datetime.utcnow()
    except Exception as e:
        current_app.logger.error(f"Failed to set updated_at: {e}")
        raise SQLAlchemyError("Failed to process timestamp") from e

class ProcessingResult(db.Model):
    """Model for storing AI processing results."""
    __tablename__ = 'processing_results'
    
    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, ForeignKey('media_assets.id', ondelete='CASCADE'), nullable=False)
    processor_name = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # pending, processing, completed, failed
    result_data = db.Column(db.JSON, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with asset
    media_asset = db.relationship('MediaAsset', back_populates='processing_results')
    
    def __init__(self, **kwargs):
        """Initialize with proper type conversion"""
        super().__init__(**kwargs)
    
    def to_dict(self):
        """Convert to API-friendly format."""
        return {
            'id': self.id,
            'asset_id': self.asset_id,
            'processor_name': self.processor_name,
            'status': self.status,
            'result_data': self.result_data,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }