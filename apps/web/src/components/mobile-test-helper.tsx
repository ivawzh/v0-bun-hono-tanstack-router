/**
 * Mobile Test Helper Component
 * 
 * This component provides visual testing aids for mobile responsive design.
 * It shows current screen size, touch target measurements, and accessibility indicators.
 * Only visible in development mode.
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface MobileTestHelperProps {
  enabled?: boolean
}

const COMMON_MOBILE_SIZES = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'iPhone 14 Pro', width: 393, height: 852 },
  { name: 'Samsung S20', width: 360, height: 800 },
  { name: 'Pixel 5', width: 393, height: 851 },
  { name: 'iPad Mini', width: 768, height: 1024 }
]

export function MobileTestHelper({ enabled = process.env.NODE_ENV === 'development' }: MobileTestHelperProps) {
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    const updateSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', updateSize)
    updateSize()

    return () => window.removeEventListener('resize', updateSize)
  }, [])

  if (!enabled) return null

  const currentDevice = COMMON_MOBILE_SIZES.find(
    device => Math.abs(device.width - screenSize.width) <= 10
  )

  return (
    <>
      {/* Debug Info Panel */}
      <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white text-xs p-2 rounded-lg font-mono">
        <div>Screen: {screenSize.width}×{screenSize.height}</div>
        {currentDevice && <div>Device: {currentDevice.name}</div>}
        <button
          onClick={() => setShowOverlay(!showOverlay)}
          className="mt-1 px-2 py-1 bg-blue-600 rounded text-white"
        >
          {showOverlay ? 'Hide' : 'Show'} Touch Targets
        </button>
      </div>

      {/* Touch Target Overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-[9998] pointer-events-none">
          <style>
            {`
              .mobile-test-overlay button,
              .mobile-test-overlay [role="button"],
              .mobile-test-overlay [role="switch"] {
                outline: 2px solid red !important;
                outline-offset: -2px !important;
              }
              
              .mobile-test-overlay button:before,
              .mobile-test-overlay [role="button"]:before,
              .mobile-test-overlay [role="switch"]:before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 44px;
                height: 44px;
                transform: translate(-50%, -50%);
                border: 1px dashed yellow;
                background: rgba(255, 255, 0, 0.1);
                pointer-events: none;
                z-index: 10000;
              }
            `}
          </style>
          <div className="mobile-test-overlay w-full h-full" />
        </div>
      )}
    </>
  )
}

/**
 * Hook for responsive testing
 */
export function useResponsiveTest() {
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      setScreenSize({ width, height })
      setOrientation(width > height ? 'landscape' : 'portrait')
    }

    window.addEventListener('resize', updateSize)
    updateSize()

    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const isMobile = screenSize.width < 768
  const isTablet = screenSize.width >= 768 && screenSize.width < 1024
  const isDesktop = screenSize.width >= 1024

  return {
    screenSize,
    orientation,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
  }
}