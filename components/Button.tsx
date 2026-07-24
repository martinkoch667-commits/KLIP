'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: 'var(--leaf)', color: 'var(--leaf-ink)', fontWeight: 700, border: 'none' },
  secondary: { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  dark:      { background: '#080808', color: '#F5F4EF', fontWeight: 600, border: 'none' },
  danger:    { background: '#FF4D3B', color: 'white',  fontWeight: 600, border: 'none' },
  ghost:     { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
};

export default function Button({
  variant = 'primary',
  children,
  className = '',
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`klip-btn ${className}`}
      style={{
        ...variantStyles[variant],
        padding: '10px 20px',
        borderRadius: 8,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
