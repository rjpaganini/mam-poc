"""
Test script for WebSocket implementation with protocol validation.
Matches the server's protocol handling and connection lifecycle.
"""
import asyncio
import websockets
import json
import logging
import signal
from typing import List, Optional
from websockets.typing import Subprotocol
import traceback

# Configure logging with more detail
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/websocket_test.log')
    ]
)
logger = logging.getLogger(__name__)

# Global flag for shutdown
shutdown_flag = False

def handle_shutdown(signum, frame):
    """Handle shutdown signals gracefully."""
    global shutdown_flag
    logger.info(f"Received shutdown signal {signum}, initiating graceful shutdown...")
    shutdown_flag = True

async def test_websocket():
    """Test WebSocket connection with proper protocol and handshake."""
    uri = "ws://localhost:5001/api/v1/ws"
    protocols: List[Subprotocol] = [Subprotocol('mam-protocol')]
    
    logger.info(f"Connecting to {uri} with protocols: {protocols}")
    logger.debug(f"Connection parameters: ping_interval=20, ping_timeout=10, close_timeout=5")
    
    try:
        async with websockets.connect(
            uri,
            subprotocols=protocols,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
            max_size=10 * 1024 * 1024,  # 10MB max message size
            logger=logger  # Pass logger to websockets
        ) as websocket:
            logger.info("WebSocket connection established")
            
            # Wait for welcome message
            try:
                welcome = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                welcome_data = json.loads(welcome)
                logger.info(f"Received welcome: {welcome_data}")
                
                if welcome_data.get('type') != 'welcome':
                    logger.error(f"Unexpected message type: {welcome_data.get('type')}")
                    return
                    
                if welcome_data.get('protocol') != 'mam-protocol':
                    logger.error(f"Protocol mismatch: {welcome_data.get('protocol')}")
                    return
                    
            except asyncio.TimeoutError:
                logger.error("Welcome message timeout")
                return
            except Exception as e:
                logger.error(f"Error receiving welcome: {e}")
                return
                
            # Send handshake
            handshake = {
                "type": "handshake",
                "timestamp": int(asyncio.get_event_loop().time() * 1000),
                "client": "test-script",
                "protocol": websocket.subprotocol
            }
            logger.info(f"Sending handshake: {handshake}")
            await websocket.send(json.dumps(handshake))
            
            # Wait for handshake response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                logger.info(f"Received handshake response: {response_data}")
                
                if response_data.get('type') != 'handshake_response':
                    logger.error(f"Unexpected response type: {response_data.get('type')}")
                    return
                    
                if response_data.get('status') != 'success':
                    logger.error(f"Handshake failed: {response_data}")
                    return
                    
            except asyncio.TimeoutError:
                logger.error("Handshake response timeout")
                return
            except Exception as e:
                logger.error(f"Error receiving handshake response: {e}")
                return
            
            # Send test message
            message = {
                "type": "test",
                "message": "Hello from test script!",
                "timestamp": int(asyncio.get_event_loop().time() * 1000)
            }
            logger.info(f"Sending test message: {message}")
            await websocket.send(json.dumps(message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                logger.info(f"Received response: {response_data}")
            except asyncio.TimeoutError:
                logger.error("Response timeout")
                return
            except Exception as e:
                logger.error(f"Error receiving response: {e}")
                return
                
            # Keep connection alive with ping/pong
            ping_count = 0
            while not shutdown_flag and ping_count < 3:  # Test with 3 ping-pongs
                try:
                    # Send ping every 20 seconds
                    await asyncio.sleep(20)
                    
                    # Check shutdown flag after sleep
                    if shutdown_flag:
                        logger.info("Shutdown requested, closing connection...")
                        break
                        
                    ping = {
                        "type": "ping",
                        "timestamp": int(asyncio.get_event_loop().time() * 1000),
                        "sequence": ping_count
                    }
                    await websocket.send(json.dumps(ping))
                    logger.debug(f"Ping sent: {ping}")
                    
                    # Wait for pong response
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    response_data = json.loads(response)
                    logger.debug(f"Received pong: {response_data}")
                    
                    if response_data.get('type') != 'pong':
                        logger.error(f"Unexpected response type: {response_data.get('type')}")
                        break
                        
                    ping_count += 1
                    
                except asyncio.TimeoutError:
                    logger.error("Ping/pong timeout")
                    break
                except websockets.ConnectionClosed:
                    logger.info("Connection closed by server")
                    break
                except Exception as e:
                    logger.error(f"Error in ping/pong cycle: {e}")
                    logger.error(traceback.format_exc())
                    break
            
            # Send goodbye message
            try:
                goodbye = {
                    "type": "goodbye",
                    "timestamp": int(asyncio.get_event_loop().time() * 1000),
                    "reason": "Test completed"
                }
                await websocket.send(json.dumps(goodbye))
                logger.info("Goodbye message sent")
            except Exception as e:
                logger.error(f"Error sending goodbye: {e}")
            
            logger.info("WebSocket test completed")
            
    except websockets.InvalidHandshake as e:
        logger.error(f"Invalid handshake: {e}")
        logger.error(f"Response headers: {getattr(e, 'headers', 'No headers available')}")
        logger.error(f"Raw request: {getattr(e, 'request', 'No request available')}")
    except websockets.InvalidState as e:
        logger.error(f"Protocol error: {e}")
        logger.error(f"WebSocket state: {getattr(e, 'state', 'Unknown state')}")
    except websockets.ConnectionClosed as e:
        logger.error(f"Connection closed: {e}")
        logger.error(f"Close code: {e.code}")
        logger.error(f"Close reason: {e.reason}")
        logger.error(f"Connection state: {getattr(e, 'state', 'Unknown state')}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.error(traceback.format_exc())

async def main():
    """Main entry point with signal handling and test execution."""
    # Register signal handlers
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, handle_shutdown)
        
    logger.info("Starting WebSocket test (Press Ctrl+C to exit gracefully)...")
    logger.info("Python WebSocket Test Script v1.0.0")
    logger.info(f"Using websockets library version: {websockets.__version__}")
    
    await test_websocket()
    logger.info("Test script finished")

if __name__ == "__main__":
    asyncio.run(main()) 