"""
backend/cloud/lambda/trigger_config.py
==========================================
S3 Trigger Configuration for Lambda
==========================================

Configures S3 bucket notifications to trigger Lambda function
and sets up necessary IAM permissions.

Features:
1. Auto-configures S3 event notifications
2. Sets up IAM roles and policies
3. Validates configuration
4. Handles cleanup

Author: Senior Developer
Date: 2024
"""

import boto3
import json
import logging
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TriggerConfigurator:
    """Handles S3 trigger setup for Lambda function"""
    
    def __init__(self, bucket_name, function_name):
        """Initialize with bucket and function names"""
        self.bucket_name = bucket_name
        self.function_name = function_name
        self.s3_client = boto3.client('s3')
        self.lambda_client = boto3.client('lambda')
        self.iam_client = boto3.client('iam')
        
    def setup_bucket_notification(self):
        """Configure S3 bucket to trigger Lambda"""
        logger.info(f"Setting up S3 trigger for bucket {self.bucket_name}")
        
        try:
            # Get Lambda function ARN
            function = self.lambda_client.get_function(
                FunctionName=self.function_name
            )
            function_arn = function['Configuration']['FunctionArn']
            
            # Add bucket notification
            self.s3_client.put_bucket_notification_configuration(
                Bucket=self.bucket_name,
                NotificationConfiguration={
                    'LambdaFunctionConfigurations': [
                        {
                            'LambdaFunctionArn': function_arn,
                            'Events': ['s3:ObjectCreated:*'],
                            'Filter': {
                                'Key': {
                                    'FilterRules': [
                                        {
                                            'Name': 'suffix',
                                            'Value': '.jpg'  # Only trigger on frame images
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            )
            
            # Grant S3 permission to invoke Lambda
            self.lambda_client.add_permission(
                FunctionName=self.function_name,
                StatementId='S3InvokeLambda',
                Action='lambda:InvokeFunction',
                Principal='s3.amazonaws.com',
                SourceArn=f'arn:aws:s3:::{self.bucket_name}'
            )
            
            logger.info("S3 trigger configured successfully")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to set up S3 trigger: {e}")
            raise
            
    def validate_configuration(self):
        """Validate trigger configuration"""
        try:
            # Check bucket notification
            response = self.s3_client.get_bucket_notification_configuration(
                Bucket=self.bucket_name
            )
            
            # Verify Lambda configuration exists
            has_lambda_config = any(
                config.get('LambdaFunctionArn', '').endswith(self.function_name)
                for config in response.get('LambdaFunctionConfigurations', [])
            )
            
            if not has_lambda_config:
                logger.warning("Lambda trigger not found in bucket configuration")
                return False
                
            logger.info("Trigger configuration validated successfully")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to validate configuration: {e}")
            return False

if __name__ == '__main__':
    # Example usage
    configurator = TriggerConfigurator(
        bucket_name='video-processing-frames',
        function_name='process-video-frames'
    )
    configurator.setup_bucket_notification()
    configurator.validate_configuration() 