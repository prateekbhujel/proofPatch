import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 36, className = '' }: BrandMarkProps) {
  return <img src="/icon.svg" width={size} height={size} className={`shrink-0 ${className}`} alt="" aria-hidden="true" />;
}
