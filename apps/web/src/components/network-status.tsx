import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface NetworkStatusProps {
  className?: string;
  showDetails?: boolean;
}

type NetworkState = 'online' | 'offline' | 'checking' | 'error';

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const [networkState, setNetworkState] = useState<NetworkState>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);

  const checkServerHealth = async (): Promise<boolean> => {
    const baseURL = (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:8500';
    
    try {
      console.log('🔍 Checking server health at:', baseURL);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${baseURL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Server is reachable');
        return true;
      } else {
        console.warn(`⚠️ Server responded with ${response.status}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Server health check failed:', error);
      return false;
    }
  };

  const checkNetworkStatus = async () => {
    setNetworkState('checking');
    setLastChecked(new Date());

    if (!navigator.onLine) {
      setNetworkState('offline');
      setServerReachable(false);
      return;
    }

    try {
      const isReachable = await checkServerHealth();
      setServerReachable(isReachable);
      setNetworkState(isReachable ? 'online' : 'error');
      
      if (!isReachable) {
        toast.error('Server Unreachable', {
          description: 'The backend server is not responding. Please check if it\'s running.',
          action: {
            label: 'Retry',
            onClick: () => checkNetworkStatus()
          }
        });
      }
    } catch (error) {
      console.error('Network check failed:', error);
      setNetworkState('error');
      setServerReachable(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkNetworkStatus();

    // Listen to online/offline events
    const handleOnline = () => {
      console.log('📡 Browser reports: ONLINE');
      checkNetworkStatus();
    };

    const handleOffline = () => {
      console.log('📡 Browser reports: OFFLINE');
      setNetworkState('offline');
      setServerReachable(false);
      toast.warning('Network Offline', {
        description: 'You are currently offline. Some features may not work.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic health checks
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const getStatusIcon = () => {
    switch (networkState) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'checking':
        return <Wifi className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Wifi className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (networkState) {
      case 'online':
        return 'Connected';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Server Error';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (networkState) {
      case 'online':
        return 'text-green-600';
      case 'offline':
        return 'text-red-600';
      case 'error':
        return 'text-amber-600';
      case 'checking':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div 
      className={`flex items-center gap-2 ${className}`}
      onClick={checkNetworkStatus}
      role="button"
      tabIndex={0}
      title="Click to refresh network status"
    >
      {getStatusIcon()}
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      
      {showDetails && lastChecked && (
        <span className="text-xs text-gray-500">
          ({lastChecked.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
};