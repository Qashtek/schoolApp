'use client';

import type { MouseEvent, ReactNode } from 'react';

interface ConfirmSubmitButtonProps {
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}

export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: ConfirmSubmitButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
