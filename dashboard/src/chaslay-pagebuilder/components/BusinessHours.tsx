// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { BusinessHoursProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Switch } from '@/chaslay-pagebuilder/ui/switch';
import { Clock } from 'lucide-react';
import { TranslatableInput } from './TranslatableInput';
import { useSectionTranslations } from '../utils/use-section-translations';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';
import { useStorefrontHours } from '../utils/use-storefront-hours';
import { useStorefront } from '../StorefrontContext';
import { isChannelOpenAt } from '@/lib/shop-hours';

const defaultProps: BusinessHoursProps = {
  sectionId: SECTION_ANCHORS.openingHours,
  title: 'Opening Hours',
  showCurrentStatus: true,
  backgroundColor: '#f8f9fa',
  textColor: '#1a1a2e',
  highlightToday: true,
};

// Placeholder hours for preview
const placeholderHours = [
  { day: 'Monday', hours: '11:00 AM - 10:00 PM', isOpen: true },
  { day: 'Tuesday', hours: '11:00 AM - 10:00 PM', isOpen: true },
  { day: 'Wednesday', hours: '11:00 AM - 10:00 PM', isOpen: true },
  { day: 'Thursday', hours: '11:00 AM - 10:00 PM', isOpen: true },
  { day: 'Friday', hours: '11:00 AM - 11:00 PM', isOpen: true },
  { day: 'Saturday', hours: '10:00 AM - 11:00 PM', isOpen: true },
  { day: 'Sunday', hours: 'Closed', isOpen: false },
];

export const BusinessHours: React.FC<BusinessHoursProps> & {
  craft: {
    props: BusinessHoursProps;
    related: { settings: React.FC };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { tr, trText, trList } = useSectionTranslations(mergedProps as Record<string, unknown>);
  const { isStorefront, storeHours } = useStorefront();
  const liveHours = useStorefrontHours();
  const {
    connectors: { connect, drag },
  } = useNode();

  // Get current day (0 = Sunday, 1 = Monday, etc.)
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1; // Adjust to match our array (Monday = 0)

  const rows = liveHours.length
    ? liveHours.map((item) => ({
        day: item.day,
        hours: item.time,
        isOpen: item.open,
        isToday: !!item.isToday,
      }))
    : placeholderHours.map((item, index) => ({
        day: item.day,
        hours: item.isOpen ? item.hours : trText('Closed'),
        isOpen: item.isOpen,
        isToday: index === todayIndex,
      }));

  const openNow = isStorefront && storeHours
    ? isChannelOpenAt(storeHours, 'takeaway').open ||
      isChannelOpenAt(storeHours, 'delivery').open ||
      isChannelOpenAt(storeHours, 'dine_in').open
    : placeholderHours[todayIndex].isOpen;

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      id={sectionAnchorId(mergedProps.sectionId, 'openingHours')}
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '60px 20px',
        width: '100%',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {tr('title') && (
          <h2
            style={{
              fontSize: '36px',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <Clock size={36} />
            {tr('title')}
          </h2>
        )}

        {mergedProps.showCurrentStatus && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: '32px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                backgroundColor: openNow ? '#22c55e' : '#ef4444',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                }}
              />
              {openNow ? trText('Open Now') : trText('Closed')}
            </span>
          </div>
        )}

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {rows.map((item, index) => (
            <div
              key={`${item.day}-${index}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: index < rows.length - 1 ? '1px solid #e9ecef' : 'none',
                backgroundColor: mergedProps.highlightToday && item.isToday ? '#f0f9ff' : 'transparent',
              }}
            >
              <span
                style={{
                  fontWeight: mergedProps.highlightToday && item.isToday ? 700 : 500,
                  color: mergedProps.textColor,
                }}
              >
                {liveHours.length ? item.day : trText(item.day)}
                {mergedProps.highlightToday && item.isToday && (
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    {trText('Today')}
                  </span>
                )}
              </span>
              <span
                style={{
                  color: item.isOpen ? mergedProps.textColor : '#ef4444',
                  fontWeight: item.isOpen ? 400 : 600,
                }}
              >
                {liveHours.length ? item.hours : trText(item.hours)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BusinessHoursSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    title,
    showCurrentStatus,
    backgroundColor,
    textColor,
    highlightToday,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    showCurrentStatus: node.data.props.showCurrentStatus,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    highlightToday: node.data.props.highlightToday,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Title"
        propKey="title"
        value={title}
        onChange={(v) => setProp((props: BusinessHoursProps) => (props.title = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <div className="flex items-center justify-between">
        <Label>Show Current Status</Label>
        <Switch
          checked={showCurrentStatus}
          onCheckedChange={(checked) => setProp((props: BusinessHoursProps) => (props.showCurrentStatus = checked))}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Highlight Today</Label>
        <Switch
          checked={highlightToday}
          onCheckedChange={(checked) => setProp((props: BusinessHoursProps) => (props.highlightToday = checked))}
        />
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(e) => setProp((props: BusinessHoursProps) => (props.backgroundColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input
          type="color"
          value={textColor}
          onChange={(e) => setProp((props: BusinessHoursProps) => (props.textColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
        Note: Business hours will be automatically loaded from your business settings when displayed on the storefront.
      </div>
    </div>
  );
};

BusinessHours.craft = {
  props: defaultProps,
  related: {
    settings: BusinessHoursSettings,
  },
};
