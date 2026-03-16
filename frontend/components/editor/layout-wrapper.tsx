"use client"

import { memo } from "react"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export const LayoutWrapper = memo(function LayoutWrapper({
  children,
}: LayoutWrapperProps) {
  return (
    <div 
      className="h-screen w-full flex flex-col bg-background text-foreground transition-colors duration-200"
      suppressHydrationWarning
    >
      {children}
    </div>
  )
})
