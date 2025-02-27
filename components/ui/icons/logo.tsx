import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
  [key: string]: any;
}

const Logo: React.FC<LogoProps> = ({
  className = '',
  width = 100,
  height = 100,
  alt = 'Logo',
  ...props
}) => {
  return (
    <Image
      {...props}
      src="/snc-logo.png"
      width={width}
      height={height}
      alt={alt}
      className={className}
    />
  );
};

export default Logo;
