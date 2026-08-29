// @ts-nocheck
'use client';

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ images, currentIndex, onClose, onPrev, onNext }) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onPrev();
    if (e.key === 'ArrowRight') onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <X size={24} />
      </button>

      {/* Prev button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image */}
      <img
        src={images[currentIndex]}
        alt={`Gallery image ${currentIndex + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          objectFit: 'contain',
          borderRadius: '4px',
        }}
      />

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Counter */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '14px',
      }}>
        {currentIndex + 1} / {images.length}
      </div>
    </div>,
    document.body
  );
};
