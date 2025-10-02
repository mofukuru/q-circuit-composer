import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

interface TooltipProps {
  content: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  trigger?: 'hover' | 'click' | 'focus';
  maxWidth?: number | string;
  className?: string;
  bubbleClassName?: string;
  disabled?: boolean;
  fullWidth?: boolean; // make wrapper expand to parent's width (useful for flex buttons)
  open?: boolean; // optional controlled mode
  onOpenChange?: (open: boolean) => void;
  portal?: boolean; // render bubble in a portal to body to avoid clipping
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  trigger = 'hover',
  maxWidth = 260,
  className,
  bubbleClassName,
  disabled = false,
  fullWidth = false,
  open,
  onOpenChange,
  portal = true,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const isControlled = typeof open === 'boolean';
  const isOpen = disabled ? false : (isControlled ? open! : internalOpen);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string }>({ top: 0, left: 0, transform: '' });

  useEffect(() => {
    if (trigger !== 'click' || disabled) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        isControlled ? onOpenChange?.(false) : setInternalOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [trigger, disabled, isControlled, onOpenChange]);

  // Hover trigger handling (works for portal as well)
  const handleMouseEnter = () => {
    if (trigger !== 'hover' || disabled) return;
    isControlled ? onOpenChange?.(true) : setInternalOpen(true);
  };
  const handleMouseLeave = () => {
    if (trigger !== 'hover' || disabled) return;
    isControlled ? onOpenChange?.(false) : setInternalOpen(false);
  };

  // Compute fixed coordinates for portal tooltips
  useEffect(() => {
    if (!isOpen || !portal || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const offset = 8;
    let top = 0, left = 0, transform = '';
    switch (position) {
      case 'top':
        top = rect.top - offset;
        left = rect.left + rect.width / 2;
        transform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2;
        transform = 'translate(-50%, 0)';
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + offset;
        transform = 'translate(0, -50%)';
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - offset;
        transform = 'translate(-100%, -50%)';
        break;
    }
    setCoords({ top, left, transform });
  }, [isOpen, portal, position, wrapperRef.current]);

  useEffect(() => {
    if (!portal) return;
    const handler = () => {
      if (!isOpen) return;
      // recompute on scroll/resize
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const offset = 8;
      let top = 0, left = 0, transform = '';
      switch (position) {
        case 'top':
          top = rect.top - offset;
          left = rect.left + rect.width / 2;
          transform = 'translate(-50%, -100%)';
          break;
        case 'bottom':
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2;
          transform = 'translate(-50%, 0)';
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + offset;
          transform = 'translate(0, -50%)';
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - offset;
          transform = 'translate(-100%, -50%)';
          break;
      }
      setCoords({ top, left, transform });
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    // observe layout mutations to recompute position
    const obs = new MutationObserver(handler);
    if (wrapperRef.current) obs.observe(wrapperRef.current, { attributes: true, childList: true, subtree: true });
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
      obs.disconnect();
    };
  }, [isOpen, portal, position]);

  const wrapperClass = useMemo(() => [
    'tooltip-wrapper',
    fullWidth ? 'full-width' : '',
    className || '',
  ].filter(Boolean).join(' '), [fullWidth, className]);

  const bubbleStyle = useMemo<React.CSSProperties>(() => ({
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    ...(portal && isOpen ? { position: 'fixed', top: coords.top, left: coords.left, transform: coords.transform } : {}),
  }), [maxWidth, portal, isOpen, coords]);

  const handleClick = (e: React.MouseEvent) => {
    if (trigger !== 'click' || disabled) return;
    // prevent label default behavior (forwarding click to associated input)
    e.preventDefault();
    e.stopPropagation();
    const next = !isOpen;
    isControlled ? onOpenChange?.(next) : setInternalOpen(next);
  };

  // Prevent label forwarding on mousedown as well for reliability
  const handleMouseDown = (e: React.MouseEvent) => {
    if (trigger === 'click') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleFocus = () => {
    if (trigger !== 'focus' || disabled) return;
    isControlled ? onOpenChange?.(true) : setInternalOpen(true);
  };

  const handleBlur = () => {
    if (trigger !== 'focus' || disabled) return;
    isControlled ? onOpenChange?.(false) : setInternalOpen(false);
  };

  return (
    <span
      ref={wrapperRef}
      className={wrapperClass}
      data-open={isOpen}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {!disabled && !portal && (
        <span
          ref={bubbleRef}
          className={['tooltip-bubble', `tooltip-${position}`, (trigger === 'click' ? 'interactive' : ''), bubbleClassName || '', isOpen ? 'open' : ''].filter(Boolean).join(' ')}
          role="tooltip"
          aria-hidden={!isOpen}
          style={bubbleStyle}
        >
          {content}
        </span>
      )}
      {!disabled && portal && isOpen && createPortal(
        <span
          ref={bubbleRef}
          className={['tooltip-bubble', 'tooltip-portal', `tooltip-${position}`, (trigger === 'click' ? 'interactive' : ''), bubbleClassName || '', 'open'].filter(Boolean).join(' ')}
          role="tooltip"
          aria-hidden={!isOpen}
          style={bubbleStyle}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
};

export default Tooltip;
