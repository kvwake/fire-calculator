import { useState, ReactNode } from 'react';
import { lookupTerm } from '../data/glossary';

// Wraps a financial term with a tooltip that shows a plain-language definition.
// Usage: <Term t="roth conversion">Roth conversion</Term>
// When wrapping badges/JSX, always provide `t` for the glossary key.

export default function Term({
  t,
  children,
}: {
  t?: string;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const isTextChild = typeof children === 'string';
  const lookupKey = t ?? (isTextChild ? children : '');
  const definition = lookupTerm(lookupKey);

  if (!definition) return <>{children}</>;

  return (
    <span
      className="relative inline"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={isTextChild
        ? 'cursor-help border-b border-dotted border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300'
        : 'cursor-help'
      }>
        {children}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-blue-200 bg-white p-3 text-left text-xs leading-relaxed text-gray-700 shadow-xl dark:border-blue-800 dark:bg-gray-800 dark:text-gray-300">
          <span className="block font-semibold text-blue-700 dark:text-blue-300 mb-1">
            {lookupKey}
          </span>
          {definition}
        </span>
      )}
    </span>
  );
}
