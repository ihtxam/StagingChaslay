// @ts-nocheck
'use client';

import React from 'react';

interface StarRatingProps {
  rating: number;
  size?: number;
  color?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({ rating, size = 16, color = '#f59e0b' }) => {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rating ? color : 'none'}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
};
