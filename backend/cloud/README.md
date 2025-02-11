# Cloud Processing Setup

## AWS Configuration
The MAM system uses AWS services for scalable video processing. Configuration is managed through environment variables and AWS credential files.

### Required AWS Services
- S3: Video frame storage
- Lambda: Processing engine
- SQS: Processing queue

### Credentials Setup
1. AWS credentials are stored in `~/.aws/credentials` using `aws configure`
2. Current configuration:
   - Region: `us-west-2` (Oregon)
   - Output format: `json`
   - Account: `140023375178`
   - IAM User: `mam-processing`

### Environment Variables
Located in `backend/cloud/config.env`:
```env
CLOUD_ENABLED=true
AWS_REGION=us-west-2
SAMPLE_RATE=1
MAX_FILE_SIZE=500000000
WEBHOOK_URL=http://localhost:5001/api/v1/webhooks/processing
```

### Testing
Run `python backend/cloud/test_processing.py` to verify:
- AWS credentials
- Video file access
- Processing pipeline

### Current Status
- ✅ AWS Authentication
- ✅ Local video access
- ✅ Basic processing framework
- ⏳ Frame extraction (TODO)
- ⏳ S3 integration (TODO)
- ⏳ Lambda processing (TODO)

### Required Permissions
Current IAM user (`mam-processing`) needs:
- `s3:PutObject`
- `s3:GetObject`
- `s3:ListBucket`
- `lambda:InvokeFunction`
- `sqs:SendMessage`
- `sqs:ReceiveMessage`

## Development Notes
- Test video: `kohls_1.mp4` successfully processed
- Using boto3 v1.36.13 for AWS SDK
- All cloud operations are async-compatible
- Processing is size-limited to 500MB for testing 