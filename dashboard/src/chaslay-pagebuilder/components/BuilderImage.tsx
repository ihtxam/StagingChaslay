// @ts-nocheck
'use client';

import React from 'react';
import { normalizeMediaUrl } from '../utils/media-url';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null;
};

/** Storefront/editor image that survives saved URL encoding and hotlink referrers. */
export function BuilderImage({ src, alt = '', ...rest }: Props) {
  const url = normalizeMediaUrl(src);
  if (!url) return null;
  return <img src={url} alt={alt} referrerPolicy="no-referrer" decoding="async" {...rest} />;
}
