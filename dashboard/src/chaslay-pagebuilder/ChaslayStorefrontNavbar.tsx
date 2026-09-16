// @ts-nocheck
'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Editor as CraftEditor, Frame } from '@craftjs/core';
import { chaslayPageBuilderResolver } from './resolver';
import { StorefrontProvider, type SitePageLink, type MerchantContact } from './StorefrontContext';
import { extractNavbarEditorState } from './extract-navbar-state';
import '@/chaslay-pagebuilder/chaslay-pagebuilder.css';

type Props = {
  shopKey: string;
  basePath: string;
  locale?: string;
  defaultLanguage?: string;
  onPresence?: (present: boolean) => void;
};

export default function ChaslayStorefrontNavbar({
  shopKey,
  basePath,
  locale = 'en',
  defaultLanguage = 'en',
  onPresence,
}: Props) {
  const wrapRef = useRef(null);
  const onPresenceRef = useRef(onPresence);
  onPresenceRef.current = onPresence;
  const [navbarState, setNavbarState] = useState(null);
  const [sitePages, setSitePages] = useState([]);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    if (!shopKey) {
      onPresenceRef.current?.(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pageRes, navRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}/pages/home`),
          axios.get(`/api/shop/${shopKey}/site-pages`).catch(() => null),
        ]);
        if (cancelled) return;
        const page = pageRes.data?.data;
        const extracted =
          page?.engine === 'chaslay' && page.editorState
            ? extractNavbarEditorState(page.editorState)
            : null;
        setNavbarState(extracted);
        onPresenceRef.current?.(Boolean(extracted));
        const m = page?.merchant;
        if (m) {
          setContact({
            phone: m.phone,
            email: m.email,
            address: m.address,
            city: m.city,
            country: m.country,
          });
        }
        const navRows = navRes?.data?.data;
        if (Array.isArray(navRows)) {
          setSitePages(
            navRows.map((p) => ({
              title: p.title,
              slug: p.slug,
              isHomepage: p.isHomepage,
              sortOrder: p.sortOrder,
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setNavbarState(null);
          onPresenceRef.current?.(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !navbarState) {
      document.documentElement.style.removeProperty('--shop-header-height');
      return;
    }
    const apply = () => {
      document.documentElement.style.setProperty('--shop-header-height', `${el.offsetHeight}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--shop-header-height');
    };
  }, [navbarState]);

  if (!navbarState) return null;

  return (
    <div ref={wrapRef} className="shop-cms-header">
      <StorefrontProvider
        shopKey={shopKey}
        basePath={basePath}
        locale={locale}
        defaultLanguage={defaultLanguage}
        sitePages={sitePages}
        contact={contact}
        surface="shop"
      >
        <div className="chaslay-pagebuilder-root chaslay-storefront-page chaslay-navbar-only">
          <CraftEditor enabled={false} resolver={chaslayPageBuilderResolver}>
            <Frame data={navbarState} />
          </CraftEditor>
        </div>
      </StorefrontProvider>
    </div>
  );
}
