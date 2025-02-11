"""
backend/cloud/lambda/build_lambda.py
==========================================
Lambda Deployment Package Builder
==========================================

Creates a deployment package for the AWS Lambda function.
Handles dependencies, layer creation, and function deployment.

Features:
1. Builds minimal deployment package
2. Creates Lambda layers for dependencies
3. Updates function configuration
4. Validates deployment

Author: Senior Developer
Date: 2024
"""

import os
import shutil
import subprocess
import boto3
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LambdaBuilder:
    """Handles Lambda function packaging and deployment"""
    
    def __init__(self):
        """Initialize builder with AWS client"""
        self.lambda_client = boto3.client('lambda')
        self.build_dir = Path('build')
        self.layer_dir = self.build_dir / 'layers'
        self.package_dir = self.build_dir / 'package'
        
    def create_build_dirs(self):
        """Create clean build directories"""
        logger.info("Creating build directories...")
        
        # Clean existing build
        if self.build_dir.exists():
            shutil.rmtree(self.build_dir)
            
        # Create fresh directories
        self.build_dir.mkdir()
        self.layer_dir.mkdir()
        self.package_dir.mkdir()
        
    def build_layer(self):
        """Build Lambda layer with dependencies"""
        logger.info("Building Lambda layer...")
        
        # Create Python directory structure
        python_dir = self.layer_dir / 'python'
        python_dir.mkdir()
        
        # Install dependencies to layer directory
        subprocess.run([
            'pip', 'install',
            '-r', 'requirements.txt',
            '-t', str(python_dir),
            '--platform', 'manylinux2014_x86_64',
            '--only-binary=:all:'
        ], check=True)
        
        # Create layer ZIP
        layer_zip = self.build_dir / 'layer.zip'
        shutil.make_archive(
            str(layer_zip.with_suffix('')),
            'zip',
            str(self.layer_dir)
        )
        
        return layer_zip
        
    def package_function(self):
        """Package Lambda function code"""
        logger.info("Packaging Lambda function...")
        
        # Copy function code
        shutil.copy('process_frames.py', self.package_dir)
        
        # Create deployment ZIP
        function_zip = self.build_dir / 'function.zip'
        shutil.make_archive(
            str(function_zip.with_suffix('')),
            'zip',
            str(self.package_dir)
        )
        
        return function_zip
        
    def deploy(self):
        """Deploy function and layer to AWS"""
        try:
            # Build components
            self.create_build_dirs()
            layer_zip = self.build_layer()
            function_zip = self.package_function()
            
            # Create/update layer
            logger.info("Publishing layer...")
            with open(layer_zip, 'rb') as zip_file:
                layer_response = self.lambda_client.publish_layer_version(
                    LayerName='video-processing-deps',
                    Description='Dependencies for video frame processing',
                    Content={'ZipFile': zip_file.read()},
                    CompatibleRuntimes=['python3.11'],
                    CompatibleArchitectures=['x86_64']
                )
            
            # Update function code
            logger.info("Updating function...")
            with open(function_zip, 'rb') as zip_file:
                function_response = self.lambda_client.update_function_code(
                    FunctionName='process-video-frames',
                    ZipFile=zip_file.read(),
                    Publish=True
                )
            
            # Update function configuration
            self.lambda_client.update_function_configuration(
                FunctionName='process-video-frames',
                Runtime='python3.11',
                Layers=[layer_response['LayerVersionArn']],
                Timeout=300,  # 5 minutes
                MemorySize=1024,  # 1GB RAM
                Environment={
                    'Variables': {
                        'LOG_LEVEL': 'INFO',
                        'MAX_BATCH_SIZE': '50'
                    }
                }
            )
            
            logger.info("Deployment complete!")
            return {
                'layer_version': layer_response['Version'],
                'function_version': function_response['Version']
            }
            
        except Exception as e:
            logger.error(f"Deployment failed: {e}")
            raise

if __name__ == '__main__':
    builder = LambdaBuilder()
    builder.deploy() 