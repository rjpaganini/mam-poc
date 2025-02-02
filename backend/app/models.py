# backend/app/models.py
# Database models with proper indexing and relationships

from datetime import datetime
from sqlalchemy import event, Table, ForeignKey
from sqlalchemy.orm import validates
from sqlalchemy.exc import SQLAlchemyError
from pathlib import Path
from flask import current_app
from .database import db
from .config import SUPPORTED_EXTENSIONS
import os

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
    
    # Relationship with assets
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
    """
    Model representing a media asset in the system.
    Includes metadata and file information.
    """
    __tablename__ = 'media_assets'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255))  # Made nullable since we might use filename initially
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(1024), unique=True, nullable=False, index=True)
    file_size = db.Column(db.BigInteger, nullable=False)  # Size in bytes for precision
    mime_type = db.Column(db.String(128), nullable=False)
    media_metadata = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())
    
    # Relationship with tags
    tags = db.relationship('Tag', secondary=asset_tags, back_populates='assets')
    
    # Add relationship to directory with named foreign key constraint
    directory_id = db.Column(
        db.Integer, 
        ForeignKey('media_directories.id', ondelete='SET NULL', name='fk_media_asset_directory'),
        nullable=True
    )
    directory = db.relationship('MediaDirectory', backref='assets')
    
    @validates('file_path')
    def validate_file_path(self, key, file_path):
        """Ensure file exists and has valid extension."""
        try:
            # Use os.path instead of Path for better compatibility with Google Drive
            if not os.path.exists(file_path):
                current_app.logger.error(f"File not found: {file_path}")
                raise ValueError(f"File not found: {file_path}")
            
            # Get extension using os.path
            _, ext = os.path.splitext(file_path)
            if ext.lower() not in SUPPORTED_EXTENSIONS:
                current_app.logger.error(f"Unsupported file type: {ext}")
                raise ValueError(f"Unsupported file type: {ext}")
            
            return os.path.abspath(file_path)
        except Exception as e:
            current_app.logger.error(f"Error validating file path: {str(e)}")
            # Don't validate on load, only on create/update
            if not hasattr(self, '_sa_instance_state') or self._sa_instance_state.transient:
                raise
            return file_path  # Return original path if validation fails during load
    
    @property
    def file_name(self):
        """Get file name from path."""
        return os.path.basename(self.file_path)
    
    @property
    def file_size_human(self):
        """Get human-readable file size."""
        size = float(self.file_size)  # Create a copy of the size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    
    def to_dict(self):
        """Convert the MediaAsset to a dictionary for API responses."""
        return {
            'id': self.id,
            'title': self.title or self.file_name,  # Fallback to filename if no title
            'description': self.description,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'file_size_human': self.file_size_human,
            'mime_type': self.mime_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'media_metadata': self.media_metadata,
            'directory_id': self.directory_id,
            'tags': [tag.name for tag in self.tags] if self.tags else []
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