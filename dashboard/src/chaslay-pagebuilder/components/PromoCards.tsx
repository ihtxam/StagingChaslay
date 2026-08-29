// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { PromoCardProps, PromoItem } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';

const defaultCards: PromoItem[] = [
  { title: 'Weekend Brunch', description: 'Enjoy our special brunch menu every Saturday & Sunday', image: '', badge: '20% Off', buttonText: 'View Menu', buttonLink: '#' },
  { title: 'Happy Hour', description: 'Half-price drinks and appetizers from 4-6 PM daily', image: '', badge: 'Daily Deal', buttonText: 'Learn More', buttonLink: '#' },
  { title: 'Family Feast', description: 'Feed the whole family with our value family platters', image: '', badge: 'Best Value', buttonText: 'Order Now', buttonLink: '#' },
];

const defaultProps: PromoCardProps = {
  title: 'Special Offers',
  cards: defaultCards,
  backgroundColor: '#f8f9fa',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
};

export const PromoCards: React.FC<PromoCardProps> & {
  craft: {
    props: PromoCardProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '64px 20px',
      }}
    >
      {mergedProps.title && (
        <h3 style={{ color: mergedProps.textColor, fontSize: '28px', fontWeight: 600, textAlign: 'center', marginBottom: '48px' }}>
          {mergedProps.title}
        </h3>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min((mergedProps.cards || []).length, 3)}, 1fr)`,
        gap: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        {(mergedProps.cards || []).map((card, i) => (
          <div key={i} style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            {card.image ? (
              <img src={card.image} alt={card.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%',
                height: '180px',
                background: `linear-gradient(135deg, ${mergedProps.accentColor}22, ${mergedProps.accentColor}08)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
              }}>
                🎉
              </div>
            )}
            <div style={{ padding: '24px', position: 'relative' }}>
              {card.badge && (
                <span style={{
                  position: 'absolute',
                  top: '-14px',
                  right: '16px',
                  backgroundColor: mergedProps.accentColor,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {card.badge}
                </span>
              )}
              <h4 style={{ color: mergedProps.textColor, fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{card.title}</h4>
              <p style={{ color: mergedProps.textColor, opacity: 0.7, fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>{card.description}</p>
              {card.buttonText && (
                <span style={{
                  color: mergedProps.accentColor,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  {card.buttonText} →
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PromoCardsSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    cards: node.data.props.cards ?? defaultProps.cards,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  const addCard = () => setProp((props: PromoCardProps) => {
    props.cards = [...(props.cards || []), { title: 'New Offer', description: 'Describe the offer...', image: '', badge: 'New', buttonText: 'Learn More', buttonLink: '#' }];
  });
  const removeCard = (i: number) => setProp((props: PromoCardProps) => {
    props.cards = (props.cards || []).filter((_, idx) => idx !== i);
  });

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: PromoCardProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: PromoCardProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: PromoCardProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: PromoCardProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Promo Cards</Label>
          <Button variant="outline" size="sm" onClick={addCard}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(p.cards || []).map((card: PromoItem, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeCard(i)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <TranslatableArrayInput propKey="title" arrayPropKey="cards" index={i} nodeProps={p.nodeProps} setProp={setProp} value={card.title} onChange={(v) => setProp((props: PromoCardProps) => { if (props.cards) props.cards[i].title = v; })} placeholder="Title" className="h-8 text-xs" />
              <TranslatableArrayInput propKey="description" arrayPropKey="cards" index={i} nodeProps={p.nodeProps} setProp={setProp} value={card.description} onChange={(v) => setProp((props: PromoCardProps) => { if (props.cards) props.cards[i].description = v; })} placeholder="Description" className="text-xs" multiline rows={2} />
              <Input value={card.image || ''} onChange={(e) => setProp((props: PromoCardProps) => { if (props.cards) props.cards[i].image = e.target.value; })} placeholder="Image URL" className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <TranslatableArrayInput propKey="badge" arrayPropKey="cards" index={i} nodeProps={p.nodeProps} setProp={setProp} value={card.badge || ''} onChange={(v) => setProp((props: PromoCardProps) => { if (props.cards) props.cards[i].badge = v; })} placeholder="Badge" className="h-8 text-xs" />
                <TranslatableArrayInput propKey="buttonText" arrayPropKey="cards" index={i} nodeProps={p.nodeProps} setProp={setProp} value={card.buttonText || ''} onChange={(v) => setProp((props: PromoCardProps) => { if (props.cards) props.cards[i].buttonText = v; })} placeholder="Button Text" className="h-8 text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

PromoCards.craft = {
  props: defaultProps,
  related: { settings: PromoCardsSettings },
  displayName: 'Promo Cards',
};
