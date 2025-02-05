import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Connection states matching backend
export enum ConnectionState {
    INITIALIZING = 'initializing',
    READY = 'ready',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    ERROR = 'error'
}

// Event types for type safety
export interface WebSocketEvents {
    message: (message: any) => void;
    connectionStatus: (data: { status: ConnectionState; message: string }) => void;
    pong: (data: { status: string; state?: ConnectionState }) => void;
    error: (error: Error) => void;
    stateChange: (state: ConnectionState) => void;
    maxReconnectAttemptsReached: () => void;
}

export class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private readonly url: string;
    private readonly clientId: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private pingInterval: number = 30000;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
    private connectionPromise: Promise<void> = Promise.resolve();
    private connectionResolve: ((value: void | PromiseLike<void>) => void) | null = null;
    private connectionReject: ((reason?: any) => void) | null = null;

    constructor(url: string) {
        super();
        this.url = url;
        this.clientId = uuidv4();
        this.setupConnectionPromise();
    }

    private setupConnectionPromise(): void {
        this.connectionPromise = new Promise<void>((resolve, reject) => {
            this.connectionResolve = resolve;
            this.connectionReject = reject;
        });
    }

    public async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        this.setupConnectionPromise();
        this.setConnectionState(ConnectionState.INITIALIZING);

        try {
            this.ws = new WebSocket(this.url);
            this.setupWebSocketHandlers();
            return this.connectionPromise;
        } catch (error) {
            this.setConnectionState(ConnectionState.ERROR);
            throw error;
        }
    }

    private setupWebSocketHandlers(): void {
        if (!this.ws) return;

        this.ws.onopen = () => {
            logger.info('WebSocket connection opened');
            this.setConnectionState(ConnectionState.READY);
            this.reconnectAttempts = 0;
            this.sendClientId();
            this.startPingInterval();
        };

        this.ws.onclose = () => {
            logger.warn('WebSocket connection closed');
            this.setConnectionState(ConnectionState.DISCONNECTED);
            this.cleanup();
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            logger.error('WebSocket error:', error);
            this.setConnectionState(ConnectionState.ERROR);
            if (this.connectionReject) {
                this.connectionReject(new Error('WebSocket connection failed'));
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                logger.error('Error parsing WebSocket message:', error);
            }
        };
    }

    private handleMessage(message: any): void {
        switch (message.type) {
            case 'connection_status':
                this.handleConnectionStatus(message.data);
                break;
            case 'pong':
                this.handlePong(message.data);
                break;
            case 'error':
                this.handleError(message.data);
                break;
            default:
                this.emit('message', message);
        }
    }

    private handleConnectionStatus(data: any): void {
        const { status, message: statusMessage } = data;
        this.setConnectionState(status as ConnectionState);
        
        if (status === ConnectionState.CONNECTED && this.connectionResolve) {
            this.connectionResolve();
        } else if (status === ConnectionState.ERROR && this.connectionReject) {
            this.connectionReject(new Error(statusMessage));
        }
        
        this.emit('connectionStatus', { status, message: statusMessage });
    }

    private handlePong(data: any): void {
        const { status, state } = data;
        if (state && state !== this.connectionState) {
            this.setConnectionState(state as ConnectionState);
        }
        this.emit('pong', { status, state });
    }

    private handleError(data: any): void {
        const { message: errorMessage, state } = data;
        if (state === ConnectionState.ERROR) {
            this.setConnectionState(ConnectionState.ERROR);
        }
        logger.error('WebSocket error:', errorMessage);
        this.emit('error', new Error(errorMessage));
    }

    private setConnectionState(state: ConnectionState): void {
        if (this.connectionState !== state) {
            this.connectionState = state;
            this.emit('stateChange', state);
            logger.debug(`WebSocket state changed to: ${state}`);
        }
    }

    private sendClientId(): void {
        this.send({
            type: 'client_id',
            client_id: this.clientId
        });
    }

    private startPingInterval(): void {
        this.stopPingInterval();
        this.pingTimer = setInterval(() => {
            this.send({ type: 'ping' });
        }, this.pingInterval);
    }

    private stopPingInterval(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    private cleanup(): void {
        this.stopPingInterval();
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
        }
    }

    private async handleReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
            await this.connect();
        } catch (error) {
            logger.error('Reconnection attempt failed:', error);
        }
    }

    public send(data: any): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            logger.warn('Cannot send message - WebSocket is not open');
            this.emit('error', new Error('WebSocket is not open'));
        }
    }

    public getState(): ConnectionState {
        return this.connectionState;
    }

    public isConnected(): boolean {
        return this.connectionState === ConnectionState.CONNECTED;
    }

    public disconnect(): void {
        this.cleanup();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setConnectionState(ConnectionState.DISCONNECTED);
    }

    // Type declarations for EventEmitter methods
    public on<K extends keyof WebSocketEvents>(event: K, listener: WebSocketEvents[K]): this {
        return super.on(event, listener);
    }

    public emit<K extends keyof WebSocketEvents>(event: K, ...args: Parameters<WebSocketEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}

// Export singleton instance
export const wsClient = new WebSocketClient(`ws://${window.location.hostname}:5001/ws`); 